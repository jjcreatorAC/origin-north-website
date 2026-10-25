import { gsap, ScrollTrigger, reduceMotion, getLenis } from './core.js';

const EMAIL = 'info@originnorth.dk';
const QUESTIONS = 4;
const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

export function initContact() {
  const form = document.querySelector('[data-brief]');
  if (form) initBrief(form);

  // The homepage card and the brief page share a transition name, so browsers with page
  // transitions grow the card into the page and back. Only while the card is on screen;
  // from anywhere else the two pages simply cross-fade.
  const card = document.querySelector('[data-brief-cta]');
  if (card) {
    const name = () => {
      const box = card.getBoundingClientRect();
      card.style.viewTransitionName = box.bottom > 0 && box.top < window.innerHeight ? 'brief' : 'none';
    };
    document.addEventListener('click', (event) => event.target.closest('a[href="/brief/"]') && name());
    window.addEventListener('pagereveal', name);
  }

  // Close goes back to the page the brief was opened from, just as it was left.
  document.querySelectorAll('[data-brief-close]').forEach((link) =>
    link.addEventListener('click', (event) => {
      if (document.referrer.startsWith(window.location.origin) && window.history.length > 1) {
        event.preventDefault();
        window.history.back();
      }
    }),
  );

  document.querySelectorAll('[data-copy]').forEach((button) => {
    const label = button.querySelector('[data-copy-label]') || button;
    let reset = 0;
    button.addEventListener('click', async () => {
      clearTimeout(reset);
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        label.textContent = 'Copied';
        button.classList.add('is-done');
      } catch {
        label.textContent = 'Copy failed';
      }
      reset = setTimeout(() => {
        label.textContent = 'Copy';
        button.classList.remove('is-done');
      }, 2200);
    });
  });
}

/**
 * The project brief: four short questions, one at a time, then a review.
 * Each question slides up into place; Enter moves on. The finished brief is
 * sent straight to the inbox, or composed in the visitor's email app if
 * sending isn't possible.
 */
function initBrief(form) {
  const steps = [...form.querySelectorAll('[data-step]')];
  const stage = form.querySelector('[data-brief-stage]');
  const count = form.querySelector('[data-brief-count]');
  const bar = form.querySelector('[data-brief-bar]');
  const announce = form.querySelector('[data-brief-announce]');
  const back = form.querySelector('[data-brief-back]');
  const nav = form.querySelector('[data-brief-nav]');
  const nextLabel = form.querySelector('[data-brief-next-label]');
  const key = form.querySelector('[data-brief-key]');
  const note = form.querySelector('[data-brief-note]');
  const status = form.querySelector('[data-brief-status]');
  const done = form.querySelector('[data-brief-done]');
  const summary = form.querySelector('[data-summary]');
  const editor = createEditor(form.querySelector('[data-editor]'), () => form.requestSubmit());
  const endpoint = form.dataset.endpoint;
  const review = steps.length - 1;
  const still = reduceMotion();

  let current = 0;
  let transition = null;
  let sending = false;

  form.classList.add('is-stepped');
  form.querySelectorAll('[data-brief-head], [data-brief-keys], [data-brief-back]').forEach((el) => (el.hidden = false));
  steps.forEach((step, i) => (step.hidden = i !== current));

  // On its own page, the first question rises into place as the page opens.
  if (form.classList.contains('brief--page') && !still) {
    gsap.from([form.querySelector('[data-brief-head]'), ...steps[0].children, nav], {
      autoAlpha: 0,
      y: 28,
      duration: 1.1,
      ease: 'expo.out',
      stagger: 0.06,
      delay: 0.12,
      clearProps: 'all',
    });
  }

  /* ───── Answers and checks ───── */

  const collect = () => {
    const data = new FormData(form);
    const value = (name) => String(data.get(name) || '').trim();
    return {
      needs: data.getAll('needs'),
      message: editor ? editor.text() : value('message'),
      timing: value('timing'),
      name: value('name'),
      company: value('company'),
      email: value('email'),
      phone: value('phone'),
      honey: value('_honey'),
    };
  };

  const showError = (name, invalid, input) => {
    document.getElementById(`f-${name}-error`).hidden = !invalid;
    if (input) input.setAttribute('aria-invalid', String(invalid));
    return !invalid;
  };

  // Returns the first control that needs attention on a step, after marking it.
  const problems = [
    () => (showError('needs', !form.querySelector('[name="needs"]:checked')) ? null : form.querySelector('[name="needs"]')),
    () => (showError('message', collect().message.length < 2, editor?.input) ? null : editor?.input || form.elements.message),
    () => (showError('timing', !form.querySelector('[name="timing"]:checked')) ? null : form.querySelector('[name="timing"]')),
    () => {
      const nameOk = showError('name', !form.elements.name.value.trim(), form.elements.name);
      const emailOk = showError('email', !isEmail(form.elements.email.value), form.elements.email);
      return !nameOk ? form.elements.name : !emailOk ? form.elements.email : null;
    },
  ];

  // Errors clear as soon as the answer is good.
  form.addEventListener('change', (event) => {
    if (event.target.name === 'needs') showError('needs', false);
    if (event.target.name === 'timing') showError('timing', false);
  });
  form.addEventListener('input', (event) => {
    const field = event.target;
    if (field.getAttribute('aria-invalid') !== 'true') return;
    if (field.name === 'name' && field.value.trim()) showError('name', false, field);
    if (field.name === 'email' && isEmail(field.value)) showError('email', false, field);
    if (field === editor?.input && editor.text().length >= 2) showError('message', false, field);
  });

  /* ───── Moving between questions ───── */

  const firstControl = (step) =>
    step.querySelector('.editor__input, input:not([type="checkbox"]):not([type="radio"])') || step.querySelector('input');

  const refreshUi = (direction = 0) => {
    const question = Math.min(current + 1, QUESTIONS);
    const onReview = current === review;
    count.textContent = onReview ? 'Review' : `${question} / ${QUESTIONS}`;
    if (direction && !still) gsap.fromTo(count, { yPercent: 60 * direction, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'expo.out' });
    gsap.to(bar, { scaleX: (current + 1) / (QUESTIONS + 1), duration: still ? 0 : 0.9, ease: 'expo.out', overwrite: true });
    back.style.visibility = current === 0 ? 'hidden' : '';
    nextLabel.textContent = onReview ? 'Send brief' : 'Continue';
    note.textContent = onReview ? `Goes straight to ${EMAIL}.` : '';
    key.textContent = current === 1 ? `${mac ? '⌘' : 'Ctrl'} Enter ↵` : 'Enter ↵';
    announce.textContent = onReview ? 'Review your brief before sending.' : `Question ${question} of ${QUESTIONS}`;
  };

  const settle = () => {
    // The card may have changed height; keep the scenes below it measured correctly.
    ScrollTrigger.refresh();
  };

  const go = (index, { focus = true } = {}) => {
    transition?.progress(1);
    if (index === current) return;
    const from = steps[current];
    const to = steps[index];
    const direction = index > current ? 1 : -1;
    current = index;
    status.textContent = '';
    if (current === review) renderSummary();
    refreshUi(direction);

    const land = () => {
      if (!focus) return;
      const heading = to.querySelector('.brief__q');
      const target = current === review ? heading : firstControl(to);
      if (target === heading) heading.tabIndex = -1;
      target?.focus({ preventScroll: true });
      // Keep the question in view, e.g. on a phone after the keyboard closes.
      if (form.getBoundingClientRect().top < 0) {
        const lenis = getLenis();
        if (lenis) lenis.scrollTo(form, { offset: -96, duration: 0.9 });
        else form.scrollIntoView({ block: 'start' });
      }
    };

    if (still) {
      from.hidden = true;
      to.hidden = false;
      land();
      settle();
      return;
    }

    const before = stage.offsetHeight;
    gsap.set(from, { position: 'absolute', top: 0, left: 0, right: 0 });
    to.hidden = false;
    const after = stage.offsetHeight;
    const parts = [...to.children];

    transition = gsap
      .timeline({
        onComplete: () => {
          from.hidden = true;
          gsap.set([from, ...parts], { clearProps: 'all' });
          gsap.set(stage, { clearProps: 'height' });
          transition = null;
          if (before !== after) settle();
        },
      })
      .fromTo(stage, { height: before }, { height: after, duration: 0.6, ease: 'expo.out' }, 0)
      .to(from, { autoAlpha: 0, y: -24 * direction, duration: 0.26, ease: 'power2.in' }, 0)
      .fromTo(parts, { autoAlpha: 0, y: 34 * direction }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.05 }, 0.14);
    land();
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (sending) return;
    if (current < review) {
      const problem = problems[current]();
      if (problem) problem.focus();
      else go(current + 1);
      return;
    }
    send();
  });

  back.addEventListener('click', () => current > 0 && go(current - 1));

  // Enter on a chip or an option moves on too; letters pick a start time.
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.target.type === 'checkbox' || event.target.type === 'radio')) {
      event.preventDefault();
      form.requestSubmit();
    }
    if (current === 2 && /^[a-d]$/i.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const option = form.querySelectorAll('[name="timing"]')[event.key.toLowerCase().charCodeAt(0) - 97];
      option.checked = true;
      option.focus();
      option.dispatchEvent(new Event('change', { bubbles: true }));
      pickAndMove();
    }
  });

  // Clicking a start time is an answer in itself, so the brief moves on by itself.
  let picking = 0;
  const pickAndMove = () => {
    clearTimeout(picking);
    picking = setTimeout(() => current === 2 && form.requestSubmit(), 420);
  };
  form.querySelectorAll('.option').forEach((option) => option.addEventListener('click', (event) => event.detail > 0 && pickAndMove()));

  /* ───── Review ───── */

  const renderSummary = () => {
    const brief = collect();
    const rows = [
      ['What you need', brief.needs.join(' · '), 0],
      ['About the project', editor ? editor.html() : brief.message, 1],
      ['When', brief.timing, 2],
      ['Contact', [brief.name + (brief.company ? `, ${brief.company}` : ''), brief.email, brief.phone].filter(Boolean).join('\n'), 3],
    ];
    summary.replaceChildren(
      ...rows.map(([label, content, step]) => {
        const row = document.createElement('div');
        row.className = 'summary__row';
        const dt = document.createElement('dt');
        dt.textContent = label;
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'summary__edit';
        edit.textContent = 'Edit';
        edit.setAttribute('aria-label', `Edit ${label.toLowerCase()}`);
        edit.addEventListener('click', () => go(step));
        const dd = document.createElement('dd');
        if (typeof content === 'string') dd.textContent = content;
        else dd.append(content);
        if (step === 1) dd.className = 'summary__text';
        row.append(dt, edit, dd);
        return row;
      }),
    );
    // A long message is clipped with a fade; measured once the review is on screen.
    requestAnimationFrame(() =>
      summary.querySelectorAll('.summary__text').forEach((dd) => dd.classList.toggle('is-long', dd.scrollHeight > dd.clientHeight + 1)),
    );
  };

  /* ───── Sending ───── */

  const plainText = (brief) => {
    const details = [
      `What we need help with: ${brief.needs.join(', ')}`,
      `Hoping to start: ${brief.timing}`,
      `Name: ${brief.name}`,
      brief.company && `Company: ${brief.company}`,
      `Email: ${brief.email}`,
      brief.phone && `Phone: ${brief.phone}`,
    ].filter(Boolean);
    return ['Hi Origin North,', '', brief.message, '', ...details].join('\r\n');
  };

  const mailto = (brief) =>
    `mailto:${EMAIL}?subject=${encodeURIComponent(`Project brief from ${brief.company || brief.name}`)}&body=${encodeURIComponent(plainText(brief))}`;

  const setSending = (on) => {
    sending = on;
    form.classList.toggle('is-sending', on);
    nextLabel.textContent = on ? 'Sending' : 'Send brief';
  };

  const finish = (brief) => {
    const first = brief.name.split(/\s+/)[0];
    done.querySelector('[data-done-title]').textContent = `Thank you, ${first}.`;
    done.querySelector('[data-done-text]').textContent = `Your brief is with us. We'll reply to ${brief.email} to set up a short call.`;
    const leaving = [form.querySelector('[data-brief-head]'), stage, nav, note, status];
    const show = () => {
      leaving.forEach((el) => (el.hidden = true));
      done.hidden = false;
      done.focus({ preventScroll: true });
      settle();
    };
    if (still) return show();
    gsap
      .timeline()
      .to(leaving, { autoAlpha: 0, y: -16, duration: 0.3, ease: 'power2.in' })
      .add(show)
      .fromTo(done.children, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.07 })
      .fromTo(done.querySelectorAll('.brief__tick circle, .brief__tick path'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut', stagger: 0.25 }, '<0.1');
    return undefined;
  };

  const failed = (brief) => {
    const link = document.createElement('a');
    link.className = 'link';
    link.href = mailto(brief);
    link.textContent = 'send it from your email app';
    const message = document.createElement('span');
    message.append(`That didn't go through. Check your connection and try again, or `, link, '.');
    status.classList.add('is-error');
    status.replaceChildren(message);
  };

  const send = async () => {
    const brief = collect();
    status.classList.remove('is-error');
    status.textContent = '';
    if (!endpoint) {
      window.location.href = mailto(brief);
      status.textContent = `Your email app should now open with the brief ready to send. If nothing happens, write to us at ${EMAIL}.`;
      return;
    }

    setSending(true);
    try {
      // public/api/brief.php emails it to the inbox. "elapsed" helps it tell people from bots.
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...brief, elapsed: Math.round(performance.now() / 1000) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) throw new Error(result.message || `Status ${response.status}`);
      setSending(false);
      finish(brief);
    } catch (error) {
      console.warn('[brief]', error);
      setSending(false);
      failed(brief);
    }
  };

  form.querySelector('[data-brief-again]').addEventListener('click', () => {
    form.reset();
    editor?.clear();
    [form.querySelector('[data-brief-head]'), stage, nav, note, status].forEach((el) => {
      el.hidden = false;
      gsap.set(el, { clearProps: 'all' });
    });
    done.hidden = true;
    steps.forEach((step, i) => (step.hidden = i !== 0));
    current = 0;
    refreshUi();
    firstControl(steps[0])?.focus({ preventScroll: true });
    settle();
  });

  refreshUi();
}

/**
 * A small writing surface for the brief: bold, italics and bullet lists, with
 * the usual shortcuts, and "- " at the start of a line to begin a list. It
 * keeps the plain textarea filled with a readable text version, so the form
 * still works as a form, and the email arrives with **bold** and • bullets.
 */
function createEditor(wrap, onSubmit) {
  if (!wrap) return null;
  const textarea = wrap.querySelector('textarea');

  const tools = document.createElement('div');
  tools.className = 'editor__tools';
  tools.setAttribute('role', 'toolbar');
  tools.setAttribute('aria-label', 'Formatting');
  const modifier = mac ? '⌘' : 'Ctrl+';
  const buttons = [
    ['bold', 'Bold', `${modifier}B`, '<span class="editor__glyph editor__glyph--bold">B</span>'],
    ['italic', 'Italic', `${modifier}I`, '<span class="editor__glyph editor__glyph--italic">I</span>'],
    ['insertUnorderedList', 'Bulleted list', '- then space', '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="4.5" r="1.1" /><circle cx="3" cy="11.5" r="1.1" /><path d="M6.5 4.5h7M6.5 11.5h7" /></svg>'],
  ].map(([command, label, hint, icon]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'editor__tool';
    button.dataset.command = command;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', 'false');
    button.title = `${label} (${hint})`;
    button.innerHTML = icon;
    tools.append(button);
    return button;
  });
  const tip = document.createElement('p');
  tip.className = 'editor__tip';
  tip.setAttribute('aria-hidden', 'true');
  tip.textContent = `${modifier}B bold · ${modifier}I italic`;
  tools.append(tip);

  const input = document.createElement('div');
  input.className = 'editor__input is-empty';
  input.contentEditable = 'true';
  input.spellcheck = true;
  input.setAttribute('role', 'textbox');
  input.setAttribute('aria-multiline', 'true');
  input.setAttribute('aria-labelledby', textarea.getAttribute('aria-labelledby'));
  input.setAttribute('aria-describedby', textarea.getAttribute('aria-describedby'));
  input.dataset.placeholder = textarea.placeholder;
  // Lets the wheel scroll this box instead of the page once it is full.
  input.dataset.scrollInner = '';

  textarea.hidden = true;
  textarea.required = false;
  wrap.append(tools, input);
  wrap.classList.add('is-rich');

  const empty = () => !input.textContent.trim() && !input.querySelector('li');

  const text = () => {
    let out = '';
    const newline = () => {
      if (out && !out.endsWith('\n')) out += '\n';
    };
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          out += child.textContent.replace(/ /g, ' ');
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName;
          if (tag === 'BR') out += '\n';
          else if (tag === 'LI') {
            newline();
            out += '• ';
            walk(child);
            newline();
          } else if (tag === 'DIV' || tag === 'P' || tag === 'UL' || tag === 'OL') {
            newline();
            walk(child);
            newline();
          } else {
            const weight = child.style?.fontWeight;
            const mark = tag === 'B' || tag === 'STRONG' || weight === 'bold' || Number(weight) >= 600 ? '**' : tag === 'I' || tag === 'EM' ? '_' : '';
            const inner = (() => {
              const saved = out;
              out = '';
              walk(child);
              const result = out;
              out = saved;
              return result;
            })();
            out += inner.trim() ? `${mark}${inner}${mark}` : inner;
          }
        }
      }
    };
    walk(input);
    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  // A clean copy for the review: only paragraphs, bold, italics and lists survive.
  const html = () => {
    const allowed = { B: 'strong', STRONG: 'strong', I: 'em', EM: 'em', UL: 'ul', OL: 'ol', LI: 'li', BR: 'br', DIV: 'p', P: 'p' };
    const clean = (node) => {
      const fragment = document.createDocumentFragment();
      let breaks = 0;
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          if (child.textContent.trim()) breaks = 0;
          fragment.append(child.textContent);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = allowed[child.tagName];
          // Empty lines between paragraphs become the paragraphs' own spacing,
          // and a run of line breaks shows as one blank line at most.
          if (tag === 'p' && !child.textContent.trim()) continue;
          if (tag === 'br' && ++breaks > 2) continue;
          if (tag !== 'br') breaks = 0;
          const el = tag ? document.createElement(tag) : document.createDocumentFragment();
          if (tag !== 'br') el.append(clean(child));
          fragment.append(el);
        }
      }
      return fragment;
    };
    return clean(input);
  };

  const sync = () => {
    textarea.value = text();
    input.classList.toggle('is-empty', empty());
    refreshTools();
  };

  const refreshTools = () => {
    if (!input.contains(document.getSelection()?.anchorNode)) return;
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(document.queryCommandState(button.dataset.command))));
  };

  // Keep the selection in the text while clicking the toolbar.
  tools.addEventListener('mousedown', (event) => event.target.closest('.editor__tool') && event.preventDefault());
  tools.addEventListener('click', (event) => {
    const button = event.target.closest('.editor__tool');
    if (!button) return;
    if (!input.contains(document.getSelection()?.anchorNode)) input.focus();
    document.execCommand(button.dataset.command);
    sync();
  });

  input.addEventListener('input', (event) => {
    // "- " or "* " at the start of an empty line starts a bullet list.
    if (event.inputType === 'insertText' && event.data === ' ') {
      const selection = document.getSelection();
      const node = selection.anchorNode;
      // The browser keeps a typed space at the end of a line as a non-breaking one.
      const before = node?.nodeType === Node.TEXT_NODE ? node.textContent.slice(0, selection.anchorOffset).replace(/\u00a0/g, ' ') : '';
      if ((before === '- ' || before === '* ') && !node.previousSibling && !node.parentElement.closest('li')) {
        const range = document.createRange();
        range.setStart(node, 0);
        range.setEnd(node, selection.anchorOffset);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('delete');
        document.execCommand('insertUnorderedList');
      }
    }
    sync();
  });

  // Pasted text arrives as plain text, so no outside styling sneaks in.
  input.addEventListener('paste', (event) => {
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onSubmit();
    }
  });

  document.addEventListener('selectionchange', refreshTools);

  return {
    input,
    text,
    html,
    clear: () => {
      input.replaceChildren();
      sync();
    },
  };
}
