const express  = require('express');
const router   = express.Router();
const AdmZip   = require('adm-zip');
const path     = require('path');
const fs       = require('fs');
const zlib     = require('zlib');

// Root projects folder — reads from env var so NAS path works correctly
const PROJECTS_DIR = process.env.PROJECTS_DIR || path.join(__dirname, '../../../projects');

// ─────────────────────────────────────────────────────────────
// PNG generator — creates a solid-color 120×90 PNG in memory
// using only Node.js built-ins (no image library required)
// ─────────────────────────────────────────────────────────────
function makePNG(hexColor = '#1a1a2e') {
  const r = parseInt(hexColor.slice(1, 3), 16) || 26;
  const g = parseInt(hexColor.slice(3, 5), 16) || 26;
  const b = parseInt(hexColor.slice(5, 7), 16) || 46;
  const W = 120, H = 90;

  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function chunk(type, data) {
    const t = Buffer.from(type, 'ascii');
    const l = Buffer.alloc(4); l.writeUInt32BE(data.length);
    const cc = Buffer.concat([t, data]);
    const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(cc));
    return Buffer.concat([l, cc, cr]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    const o = y * (1 + W * 3);
    raw[o] = 0; // filter: None
    for (let x = 0; x < W; x++) {
      raw[o + 1 + x * 3]     = r;
      raw[o + 1 + x * 3 + 1] = g;
      raw[o + 1 + x * 3 + 2] = b;
    }
  }
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─────────────────────────────────────────────────────────────
// PHP validator — patches files missing critical WP hooks
// ─────────────────────────────────────────────────────────────
function validateAndPatchPHP(content, filename) {
  if (!content || !filename.endsWith('.php')) return content;

  // header.php must have wp_head()
  if (filename === 'header.php' && !content.includes('wp_head()')) {
    content = content.replace('</head>', "<?php wp_head(); ?>\n</head>");
  }
  // footer.php must have wp_footer()
  if (filename === 'footer.php' && !content.includes('wp_footer()')) {
    content = content.replace('</body>', "<?php wp_footer(); ?>\n</body>");
  }
  // Any template that calls get_header but not get_footer
  if (content.includes('get_header()') && !content.includes('get_footer()')) {
    content = content.trimEnd() + '\n<?php get_footer(); ?>\n';
  }
  return content;
}

// ─────────────────────────────────────────────────────────────
// Forgiving JSON extractor — handles GPT wrapping text around JSON
// ─────────────────────────────────────────────────────────────
function extractJSON(raw) {
  if (!raw) return null;
  // Strip code fences
  let s = raw.replace(/^```[\w]*\n?/gm, '').replace(/```\s*$/gm, '').trim();
  const start = s.indexOf('{');
  const end   = s.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  s = s.substring(start, end + 1);
  // Fix common GPT JSON mistakes: trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, '$1');
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/wordpress/convert
// ─────────────────────────────────────────────────────────────
router.post('/convert', (req, res) => {
  const { projectName, pages, globalContext, githubRepo } = req.body;
  const io          = req.app.get('io');
  const updateState = req.app.get('updateState');

  if (!projectName || !pages || !Array.isArray(pages)) {
    return res.status(400).json({ error: 'projectName and pages[] are required' });
  }

  try {
    updateState({ pipeline: { wordpress: 'running' } });
    io.emit('pipeline:step', { step: 'wordpress', status: 'running' });

    const themeName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^-|-$/g, '');
    const fnPrefix  = themeName.replace(/-/g, '_');
    const zip       = new AdmZip();

    // Extract primary color from context (first hex found, or default)
    const palette     = globalContext?.color_palette || '';
    const hexMatch    = palette.match(/#[0-9a-fA-F]{6}/);
    const primaryHex  = hexMatch ? hexMatch[0] : '#0a0e1a';

    const repoUri = githubRepo
      ? `https://github.com/${githubRepo}`
      : (process.env.GITHUB_OWNER && process.env.GITHUB_REPO)
        ? `https://github.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`
        : '';

    // ── 1. Try to read real PHP files from disk (n8n-generated) ──────────────
    const diskFolder = path.join(PROJECTS_DIR, projectName);
    const diskFiles  = {};  // relPath → content string

    if (fs.existsSync(diskFolder)) {
      const walk = (dir, base = '') => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const rel  = base ? `${base}/${entry.name}` : entry.name;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full, rel);
          } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (['.php', '.css', '.js', '.json', '.txt'].includes(ext)) {
              diskFiles[rel] = fs.readFileSync(full, 'utf8');
            }
          }
        }
      };
      walk(diskFolder);
    }

    const hasDiskFiles = Object.keys(diskFiles).length > 0;

    // ── 2. Fallback templates (used only when disk files are missing) ─────────
    const styleCssFallback = `/*
Theme Name: ${projectName}
${repoUri ? `Theme URI: ${repoUri}` : ''}
Author: Generated by n8n Dashboard
Description: Auto-generated WordPress theme.
Version: 1.0.0
License: MIT
Text Domain: ${themeName}
*/

:root {
  --color-primary: ${primaryHex};
  --color-bg:      #0a0e1a;
  --color-text:    #e8edf8;
  --color-accent:  #4f8fff;
  --color-border:  rgba(255,255,255,0.1);
  --fs-hero:       clamp(2.5rem, 6vw, 5rem);
  --fs-h1:         clamp(2rem, 4vw, 3rem);
  --space-md:      1.5rem;
  --container-max: 1200px;
  --radius-md:     0.5rem;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: var(--color-bg); color: var(--color-text); display: flex; flex-direction: column; min-height: 100vh; }
main { flex: 1; }
.container { max-width: var(--container-max); margin: 0 auto; padding: 0 var(--space-md); }
a { color: var(--color-accent); }
img { max-width: 100%; height: auto; }
.btn-primary { display: inline-block; padding: .75rem 1.5rem; background: var(--color-accent); color: #fff; border-radius: var(--radius-md); text-decoration: none; }
.fade-in { opacity: 0; transform: translateY(20px); transition: opacity .5s ease, transform .5s ease; }
.fade-in.visible { opacity: 1; transform: translateY(0); }
.site-header { position: sticky; top: 0; z-index: 100; background: rgba(10,14,26,.9); backdrop-filter: blur(12px); border-bottom: 1px solid var(--color-border); }
.nav-list { list-style: none; display: flex; gap: 1.5rem; }
.site-footer { background: var(--color-bg); border-top: 1px solid var(--color-border); padding: 2rem 0; text-align: center; }
`;

    const functionsFallback = `<?php
if ( ! defined( 'ABSPATH' ) ) exit;
define( '${fnPrefix.toUpperCase()}_VER', '1.0.0' );

function ${fnPrefix}_setup() {
    add_theme_support( 'title-tag' );
    add_theme_support( 'post-thumbnails' );
    add_theme_support( 'custom-logo' );
    add_theme_support( 'html5', ['search-form','comment-form','gallery','caption'] );
    add_theme_support( 'wp-block-styles' );
    add_theme_support( 'responsive-embeds' );
    register_nav_menus([
        'primary' => __( 'Primary Menu', '${themeName}' ),
        'footer'  => __( 'Footer Menu',  '${themeName}' ),
    ]);
    load_theme_textdomain( '${themeName}', get_template_directory() . '/languages' );
}
add_action( 'after_setup_theme', '${fnPrefix}_setup' );

function ${fnPrefix}_scripts() {
    wp_enqueue_style( '${themeName}-style', get_stylesheet_uri(), [], ${fnPrefix.toUpperCase()}_VER );
    wp_enqueue_script( '${themeName}-main', get_template_directory_uri() . '/assets/js/main.js', [], ${fnPrefix.toUpperCase()}_VER, true );
}
add_action( 'wp_enqueue_scripts', '${fnPrefix}_scripts' );
`;

    const headerFallback = `<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo('charset'); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<header class="site-header">
  <div class="container" style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.5rem;">
    <?php the_custom_logo(); ?>
    <a href="<?php echo esc_url(home_url('/')); ?>" class="site-title"><?php bloginfo('name'); ?></a>
    <nav aria-label="<?php esc_attr_e('Primary navigation','${themeName}'); ?>">
      <?php wp_nav_menu(['theme_location'=>'primary','menu_class'=>'nav-list','container'=>false]); ?>
    </nav>
  </div>
</header>
<main id="main" class="site-main">
`;

    const footerFallback = `</main>
<footer class="site-footer">
  <div class="container">
    <p>&copy; <?php echo date('Y'); ?> <?php bloginfo('name'); ?>.</p>
    <?php wp_nav_menu(['theme_location'=>'footer','menu_class'=>'footer-nav','container'=>false]); ?>
  </div>
</footer>
<?php wp_footer(); ?>
</body></html>
`;

    const makeSimpleTemplate = (label) => `<?php
get_header();
?>
<div class="container" style="padding:4rem 1.5rem;">
  <?php while(have_posts()):the_post(); ?>
    <article id="post-<?php the_ID();?>" <?php post_class();?>>
      <h1 class="entry-title"><?php the_title();?></h1>
      <div class="entry-content"><?php the_content();?></div>
    </article>
  <?php endwhile;?>
</div>
<?php get_footer();
`;

    // ── 3. theme.json — server-generated, always correct ─────────────────────
    const themeJson = JSON.stringify({
      "$schema": "https://schemas.wp.org/trunk/theme.json",
      "version": 3,
      "settings": {
        "appearanceTools": true,
        "color": {
          "palette": [
            { "slug": "primary",   "color": primaryHex,  "name": "Primary"   },
            { "slug": "accent",    "color": "#4f8fff",   "name": "Accent"    },
            { "slug": "bg",        "color": "#0a0e1a",   "name": "Background"},
            { "slug": "text",      "color": "#e8edf8",   "name": "Text"      },
          ],
          "custom": true,
          "customDuotone": false,
          "customGradient": true,
          "defaultDuotone": false,
          "defaultGradients": false,
          "defaultPalette": false,
        },
        "typography": {
          "customFontSize": true,
          "fontSizes": [
            { "slug": "small",  "size": "0.875rem", "name": "Small"  },
            { "slug": "medium", "size": "1rem",     "name": "Medium" },
            { "slug": "large",  "size": "1.25rem",  "name": "Large"  },
            { "slug": "hero",   "size": "clamp(2.5rem, 6vw, 5rem)", "name": "Hero" },
          ]
        },
        "spacing": {
          "padding": true,
          "margin":  true,
          "units":   ["px", "rem", "%", "vw"]
        },
        "layout": {
          "contentSize": "720px",
          "wideSize":    "1200px"
        }
      },
      "styles": {
        "color": {
          "background": "var(--wp--preset--color--bg)",
          "text":       "var(--wp--preset--color--text)"
        },
        "elements": {
          "link": {
            "color": { "text": "var(--wp--preset--color--accent)" },
            ":hover": { "color": { "text": "var(--wp--preset--color--primary)" } }
          },
          "button": {
            "color": { "background": "var(--wp--preset--color--accent)", "text": "#fff" },
            "border": { "radius": "0.5rem" }
          }
        }
      }
    }, null, 2);

    // ── 4. readme.txt ─────────────────────────────────────────────────────────
    const readmeTxt = `=== ${projectName} ===
Contributors: n8n-dashboard
Tags: custom-background, custom-logo, custom-menu, featured-images, threaded-comments
Requires at least: 6.0
Tested up to: 6.5
Requires PHP: 7.4
License: MIT
License URI: https://opensource.org/licenses/MIT

${projectName} — auto-generated WordPress theme by n8n AI Pipeline Dashboard.

== Description ==
This theme was automatically generated by the n8n AI Pipeline Dashboard.
Generated on: ${new Date().toISOString()}

== Installation ==
1. Upload the theme ZIP via Appearance > Themes > Add New > Upload Theme.
2. Click Install Now, then Activate.
3. Add a screenshot.png (1200x900 px) for the theme preview in the admin.

== Changelog ==
= 1.0.0 =
* Initial release — auto-generated.
`;

    // ── 5. main.js ────────────────────────────────────────────────────────────
    const mainJS = `/* ${projectName} — main.js */
document.addEventListener('DOMContentLoaded', function () {

  // IntersectionObserver scroll-reveal
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.fade-in, .slide-up').forEach(function (el) {
    observer.observe(el);
  });

  // Mobile hamburger
  var toggle = document.querySelector('.menu-toggle');
  var menu   = document.querySelector('.nav-list');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      menu.classList.toggle('is-open', !open);
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
    });
  });

});
`;

    // ── 6. Prompt/context page filter ────────────────────────────────────────
    const PROMPT_IDS   = new Set(['00', '01']);
    const PROMPT_NAMES = ['art_direction', 'environment_and_routing', 'supabase', 'schema', 'wp_art', 'wp_environment'];
    const isPromptPage = (p) => {
      if (PROMPT_IDS.has(String(p.id))) return true;
      const n = (p.name || '').toLowerCase();
      return PROMPT_NAMES.some(kw => n.includes(kw));
    };
    const themePages = (pages || []).filter(p => !isPromptPage(p));

    // ── 7. Build ZIP ──────────────────────────────────────────────────────────
    const prefix = `${themeName}/`;

    // Always server-generated (guaranteed correct)
    zip.addFile(`${prefix}theme.json`,         Buffer.from(themeJson,  'utf8'));
    zip.addFile(`${prefix}readme.txt`,         Buffer.from(readmeTxt,  'utf8'));
    zip.addFile(`${prefix}screenshot.png`,     makePNG(primaryHex));
    zip.addFile(`${prefix}assets/js/main.js`,  Buffer.from(mainJS,     'utf8'));
    zip.addFile(`${prefix}languages/.gitkeep`, Buffer.from(''));

    // PHP scaffold files — prefer disk-written n8n files, fall back to templates
    const scaffoldMap = {
      'style.css':    diskFiles['style.css']    || styleCssFallback,
      'functions.php':diskFiles['functions.php']|| functionsFallback,
      'header.php':   diskFiles['header.php']   || headerFallback,
      'footer.php':   diskFiles['footer.php']   || footerFallback,
      'index.php':    diskFiles['index.php']    || makeSimpleTemplate('Index'),
      'page.php':     diskFiles['page.php']     || makeSimpleTemplate('Page'),
      'single.php':   diskFiles['single.php']   || makeSimpleTemplate('Single'),
      'archive.php':  diskFiles['archive.php']  || makeSimpleTemplate('Archive'),
      '404.php':      diskFiles['404.php']      || makeSimpleTemplate('404'),
      'search.php':   diskFiles['search.php']   || makeSimpleTemplate('Search'),
    };

    for (const [relPath, content] of Object.entries(scaffoldMap)) {
      const patched = validateAndPatchPHP(content, relPath);
      zip.addFile(`${prefix}${relPath}`, Buffer.from(patched, 'utf8'));
    }

    // Cookie banner
    const cookieSrc = diskFiles['inc/cookie-banner.php'];
    if (cookieSrc) {
      zip.addFile(`${prefix}inc/cookie-banner.php`, Buffer.from(cookieSrc, 'utf8'));
    }

    // All disk files not already covered (template-parts, extra PHP, CSS, JS)
    const covered = new Set([...Object.keys(scaffoldMap), 'inc/cookie-banner.php', 'assets/js/main.js', 'style.css']);
    for (const [rel, content] of Object.entries(diskFiles)) {
      if (covered.has(rel)) continue;
      const patched = validateAndPatchPHP(content, rel);
      zip.addFile(`${prefix}${rel}`, Buffer.from(patched, 'utf8'));
    }

    // Feature page templates from builds (if not already on disk)
    themePages.forEach((page) => {
      const slug = (page.name || 'page').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      const file = `page-${slug}.php`;
      if (!diskFiles[file]) {
        zip.addFile(`${prefix}${file}`, Buffer.from(`<?php /* Template Name: ${page.name} */\nget_header();\n?>\n<div class="container" style="padding:4rem 1.5rem;" data-wp-section="${slug}">\n  <h1 class="page-title fade-in"><?php the_title(); ?></h1>\n  <div class="page-content"><?php the_content(); ?></div>\n</div>\n<?php get_footer();\n`, 'utf8'));
      }
    });

    const zipBuffer = zip.toBuffer();
    updateState({ pipeline: { wordpress: 'done' } });
    io.emit('pipeline:step', { step: 'wordpress', status: 'done' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${themeName}-wp-theme.zip"`);
    res.send(zipBuffer);

  } catch (err) {
    updateState({ pipeline: { wordpress: 'error' } });
    io.emit('pipeline:step', { step: 'wordpress', status: 'error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
