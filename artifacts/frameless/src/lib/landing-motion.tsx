import { useEffect, useRef, useState } from "react";

/**
 * Lapisan gerak untuk landing page. Sengaja terpisah dari JSX halaman:
 *  - semua elemen disasar lewat selector / atribut data-*, jadi logika CMS tidak tersentuh;
 *  - elemen baru yang muncul setelah data CMS dimuat otomatis ikut (MutationObserver);
 *  - jika JS gagal atau pengguna memilih "reduce motion", konten tetap tampil normal
 *    (keadaan tersembunyi hanya diberikan oleh skrip ini, bukan CSS bawaan).
 */

const ORANGE = "#F03820";

/** Elemen kepala section & kartu yang di-reveal bertahap. */
const HEAD_SEL = ".section-eyebrow, section h2, section h2 + p, h1:not(.fu):not([data-hero] h1), .cp-eyebrow, [data-rv-each] h2";
const ITEM_SEL = ".stat-card, .course-card, .asset-card, .reel-card, .contact-info-card, .crew-card, .footer-grid > div, .svc-item, .cc, .stat-tile, .cp-why-card, .cp-testi-card, [data-rv-item]";
/** Kartu dengan cincin tepi halus + sorotan mengikuti kursor. */
const GLOW_SEL = ".stat-card, .course-card, .asset-card, .reel-card, .contact-info-card, .svc-card, .crew-card, .svc-item, .cc, .stat-tile, .cp-why-card, .cp-testi-card, [data-rv-item]";
/** Hanya kartu ber-latar polos yang boleh diganti permukaannya (kartu bergambar jangan disentuh). */
const SURFACE_SEL = ".stat-card, .course-card, .asset-card, .contact-info-card, .svc-item, .cc, .stat-tile, .cp-why-card, .cp-testi-card";

export const MOTION_CSS = `
/* ── Reveal bertahap (hanya aktif setelah JS menandai elemen) ── */
[data-rv]{will-change:opacity,translate;animation:none!important;}
[data-rv="pre"]{opacity:0;translate:0 36px;scale:.985;}
[data-rv="pre"].rv-head,[data-rv="pre"]:is(h2,p,.section-eyebrow){filter:blur(10px);translate:0 24px;}
[data-rv="in"]{opacity:1;translate:0 0;scale:1;filter:none;
  transition:opacity .9s cubic-bezier(.16,1,.3,1) var(--rv-d,0ms),
             translate .95s cubic-bezier(.16,1,.3,1) var(--rv-d,0ms),
             scale .95s cubic-bezier(.16,1,.3,1) var(--rv-d,0ms),
             filter .9s cubic-bezier(.16,1,.3,1) var(--rv-d,0ms);}

/* ── Bilah progres scroll ── */
#lp-progress{position:fixed;top:0;left:0;right:0;height:2px;z-index:300;transform-origin:0 50%;
  transform:scaleX(var(--sp,0));background:linear-gradient(90deg,${ORANGE},#ff9a3c);box-shadow:0 0 12px ${ORANGE}99;pointer-events:none;}

/* ── Navbar: menyusut saat scroll, tautan aktif ── */
nav{transition:height .35s cubic-bezier(.16,1,.3,1),background .35s,box-shadow .35s!important;}
nav[data-scrolled="1"]{height:56px!important;background:rgba(10,10,12,.84)!important;box-shadow:0 14px 40px -22px rgba(0,0,0,.9);}
.nav-link{position:relative;}
.nav-link[data-active="1"]{color:#fff!important;background:rgba(255,255,255,.07);}
.nav-link[data-active="1"]::after{content:"";position:absolute;left:50%;bottom:-2px;width:14px;height:2px;border-radius:2px;background:${ORANGE};transform:translateX(-50%);}
section[id]{scroll-margin-top:72px;}

/* ── Kartu mulus: tanpa garis tegas, cincin gradien tipis + sorotan kursor ── */
[data-glow="surface"]{border-color:transparent!important;
  background:linear-gradient(160deg,rgba(255,255,255,.075),rgba(255,255,255,.022) 60%)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 28px 70px -36px rgba(0,0,0,.75)!important;}
[data-glow]::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;z-index:3;opacity:.75;
  background:linear-gradient(160deg,rgba(255,255,255,.24),rgba(255,255,255,.035) 38%,${ORANGE}33 100%);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;
  transition:opacity .35s;}
[data-glow]::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:2;opacity:0;
  background:radial-gradient(420px circle at var(--mx,50%) var(--my,50%),${ORANGE}26,transparent 55%);transition:opacity .35s;}
@media (hover:hover) and (pointer:fine){
  [data-glow]:hover::after{opacity:1;}
  [data-glow]:hover::before{opacity:1;}
}

/* ── Sambungan antar-section lebih halus ── */
section{border-top-color:transparent!important;border-bottom-color:transparent!important;}

/* ── Tombol: kilau saat hover ── */
.og-btn{position:relative;overflow:hidden;}
.og-btn::after{content:"";position:absolute;top:0;left:-70%;width:50%;height:100%;pointer-events:none;
  background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-20deg);transition:left .7s cubic-bezier(.16,1,.3,1);}
.og-btn:hover::after{left:130%;}

@media (prefers-reduced-motion:reduce){
  [data-rv]{transition:none!important;opacity:1!important;translate:none!important;scale:1!important;filter:none!important;}
}
@media (max-width:900px){
  [data-rv="pre"]{translate:0 22px;}
}
`;

/** Bilah progres (render sekali di dalam halaman). */
export function ScrollProgress() {
  return <div id="lp-progress" aria-hidden />;
}

/** Angka naik dari 0 saat terlihat. Mendukung teks seperti "300+" atau "4.9/5". */
export function CountUp({ value, duration = 1400 }: { value: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [text, setText] = useState(value);
  const done = useRef<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const m = /^(\D*)(\d[\d.,]*)(.*)$/.exec(value);
    // Tidak ada angka / sudah dianimasikan untuk nilai ini / reduce motion → tampilkan apa adanya.
    if (!el || !m || reduce || done.current === value) { setText(value); return; }
    const [, pre, numRaw, post] = m;
    const target = parseFloat(numRaw.replace(/\./g, "").replace(",", ".")) || 0;
    const decimals = /[.,]\d+$/.test(numRaw) && !/\d\.\d{3}$/.test(numRaw) ? (numRaw.split(/[.,]/)[1] || "").length : 0;
    const fmt = (n: number) => pre + (decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString("id-ID")) + post;

    let raf = 0;
    setText(fmt(0));
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 4);
        setText(p < 1 ? fmt(target * eased) : value);
        if (p < 1) raf = requestAnimationFrame(tick);
        else done.current = value;
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, duration]);

  return <span ref={ref} style={{ fontVariantNumeric: "tabular-nums" }}>{text}</span>;
}

/** Pasang semua efek gerak. Panggil sekali di komponen halaman landing. */
export function useLandingMotion() {
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia?.("(hover:hover) and (pointer:fine)").matches;

    // ── Kartu: tandai untuk cincin + sorotan ──
    const markGlow = (root: ParentNode) => {
      root.querySelectorAll<HTMLElement>(GLOW_SEL).forEach((el) => {
        if (el.hasAttribute("data-glow")) return;
        el.setAttribute("data-glow", el.matches(SURFACE_SEL) ? "surface" : "");
        if (getComputedStyle(el).position === "static") el.style.position = "relative";
      });
    };

    // ── Reveal bertahap ──
    const revealed = new WeakSet<Element>();
    const prepared = new WeakSet<Element>();
    const containers = new Set<Element>();
    const io = reduce ? null : new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting || revealed.has(e.target)) return;
        revealed.add(e.target);
        io!.unobserve(e.target);
        reveal(e.target);
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });

    // Halaman tanpa <section>: setiap elemen diamati sendiri-sendiri, dibatch per frame untuk stagger.
    const ioEach = reduce ? null : new IntersectionObserver((entries) => {
      const hits = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
      hits.forEach((e, i) => {
        ioEach!.unobserve(e.target);
        setIn(e.target as HTMLElement, Math.min(i, 8) * 70);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

    const setIn = (el: HTMLElement, delay: number) => {
      el.style.setProperty("--rv-d", `${delay}ms`);
      el.setAttribute("data-rv", "in");
      // Setelah selesai, lepas atribut supaya transisi hover bawaan kartu kembali normal.
      window.setTimeout(() => el.removeAttribute("data-rv"), delay + 1300);
    };

    function reveal(container: Element) {
      const heads = [...container.querySelectorAll<HTMLElement>(HEAD_SEL)].filter((e) => e.getAttribute("data-rv") === "pre");
      const items = [...container.querySelectorAll<HTMLElement>(ITEM_SEL)].filter((e) => e.getAttribute("data-rv") === "pre");
      heads.forEach((el, i) => setIn(el, i * 90));
      const base = heads.length ? 180 : 0;
      items.forEach((el, i) => setIn(el, base + Math.min(i, 9) * 70));
    }

    const prep = (container: Element) => {
      const each = container.hasAttribute("data-rv-each");
      const isRevealed = revealed.has(container);
      const apply = (el: HTMLElement, head: boolean) => {
        if (prepared.has(el)) return;
        prepared.add(el);
        if (head) el.classList.add("rv-head");
        el.setAttribute("data-rv", "pre");
        if (each) { ioEach?.observe(el); return; }
        // Konten yang datang belakangan di section yang sudah terbuka: animasikan langsung.
        if (isRevealed) requestAnimationFrame(() => requestAnimationFrame(() => setIn(el, 60)));
      };
      container.querySelectorAll<HTMLElement>(HEAD_SEL).forEach((el) => apply(el, true));
      container.querySelectorAll<HTMLElement>(ITEM_SEL).forEach((el) => apply(el, false));
    };

    const scan = () => {
      markGlow(document);
      document.querySelectorAll("section:not([data-hero]), footer, [data-rv-each]").forEach((c) => {
        if (!containers.has(c)) {
          containers.add(c);
          if (!c.hasAttribute("data-rv-each")) io?.observe(c);
        }
        if (!reduce) prep(c);
      });
    };

    let moRaf = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(moRaf);
      moRaf = requestAnimationFrame(scan);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    scan();

    // ── Scroll: progres, nav, parallax hero, tautan aktif ──
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        document.documentElement.style.setProperty("--sp", String(max > 0 ? Math.min(1, y / max) : 0));
        document.querySelector("nav")?.setAttribute("data-scrolled", y > 24 ? "1" : "0");

        if (!reduce) {
          const hero = document.querySelector<HTMLElement>("[data-hero]");
          if (hero) {
            const h = hero.offsetHeight || window.innerHeight;
            if (y < h * 1.2) {
              const content = hero.querySelector<HTMLElement>("[data-hero-content]");
              if (content) {
                content.style.transform = `translate3d(0,${(y * 0.22).toFixed(1)}px,0)`;
                content.style.opacity = String(Math.max(0, 1 - y / (h * 0.75)));
              }
              hero.querySelectorAll<HTMLElement>("[data-speed]").forEach((l) => {
                l.style.transform = `translate3d(0,${(y * parseFloat(l.dataset.speed || "0") * 6).toFixed(1)}px,0)`;
              });
            }
          }
        }

        // tautan nav aktif: section terakhir yang puncaknya sudah melewati 35% layar
        let active = "";
        document.querySelectorAll<HTMLElement>("section[id]").forEach((s) => {
          if (s.getBoundingClientRect().top <= window.innerHeight * 0.35) active = s.id;
        });
        document.querySelectorAll<HTMLElement>("a.nav-link").forEach((a) => {
          a.setAttribute("data-active", a.getAttribute("href") === `#${active}` ? "1" : "0");
        });
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    // ── Pointer: sorotan kartu + parallax hero ──
    let onMove: ((e: PointerEvent) => void) | null = null;
    if (finePointer && !reduce) {
      let pRaf = 0;
      onMove = (e: PointerEvent) => {
        cancelAnimationFrame(pRaf);
        pRaf = requestAnimationFrame(() => {
          const t = e.target as HTMLElement | null;
          const card = t?.closest?.("[data-glow]") as HTMLElement | null;
          if (card) {
            const r = card.getBoundingClientRect();
            card.style.setProperty("--mx", `${e.clientX - r.left}px`);
            card.style.setProperty("--my", `${e.clientY - r.top}px`);
          }
          const hero = document.querySelector<HTMLElement>("[data-hero]");
          if (hero) {
            const r = hero.getBoundingClientRect();
            if (r.bottom > 0) {
              hero.style.setProperty("--hx", String(((e.clientX / window.innerWidth) * 2 - 1).toFixed(3)));
              hero.style.setProperty("--hy", String(((e.clientY / window.innerHeight) * 2 - 1).toFixed(3)));
            }
          }
        });
      };
      window.addEventListener("pointermove", onMove, { passive: true });
    }

    return () => {
      mo.disconnect();
      io?.disconnect();
      ioEach?.disconnect();
      cancelAnimationFrame(moRaf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (onMove) window.removeEventListener("pointermove", onMove);
    };
  }, []);
}


/** Pasang seluruh lapisan gerak di halaman publik mana pun: <MotionLayer /> di dalam root halaman. */
export function MotionLayer() {
  useLandingMotion();
  return (
    <>
      <style>{MOTION_CSS}</style>
      <ScrollProgress />
    </>
  );
}
