/*
Subtitle Converter (SRT / VTT / SBV / Text)

Created by CasinoLove (Casinolove Kft.)

Official company details:
Registered name: Casinolove Kft.
Jurisdiction: Hungary (European Union)
Company Registration Number (Hungary): 14-09-318400
Email: hello@casinolove.org
Website: https://hu.casinolove.org/
GitHub: https://github.com/CasinoLove

License:
This project is open source. Please check the LICENSE file in the GitHub repository or the license information on our website before reuse, modification, or redistribution.
*/


(function () {
  "use strict";

  const state = {
    sourceFileName: "",
    sourceText: "",
    analysis: null,
    fixedInputText: "",
    outputText: "",
    outputFormat: "srt"
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindElements();
    bindEvents();
    updateTextTimingOptionsVisibility();
    setOutputStatus("Paste or upload subtitle content, then click Analyze and detect format.", "ok");
  }

  function bindElements() {
    const ids = [
      "fileInput",
      "pasteBtn",
      "analyzeBtn",
      "clearBtn",
      "sourceText",
      "analysisPanel",
      "detectedFormat",
      "detectedConfidence",
      "sourceFilename",
      "sourceExtension",
      "cueCount",
      "repairSummary",
      "issuesWrap",
      "issuesList",
      "applyFixesBtn",
      "targetFormat",
      "downloadName",
      "optSimplify",
      "optRepair",
      "optStripVttSettings",
      "optNormalizeLineEndings",
      "textTimingOptions",
      "genStartTime",
      "genSecondsPerBlock",
      "convertBtn",
      "swapBtn",
      "outputStatus",
      "outputText",
      "downloadBtn",
      "copyOutputBtn",
      "openOutputBtn"
    ];

    ids.forEach((id) => {
      els[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    els.fileInput.addEventListener("change", onFileSelected);
    els.pasteBtn.addEventListener("click", onPasteFromClipboard);
    els.analyzeBtn.addEventListener("click", onAnalyze);
    els.clearBtn.addEventListener("click", onClear);
    els.applyFixesBtn.addEventListener("click", onApplyFixes);
    els.targetFormat.addEventListener("change", updateTextTimingOptionsVisibility);
    els.convertBtn.addEventListener("click", onConvert);
    els.swapBtn.addEventListener("click", onSwapInputWithOutput);
    els.downloadBtn.addEventListener("click", onDownloadOutput);
    els.copyOutputBtn.addEventListener("click", onCopyOutput);
    els.openOutputBtn.addEventListener("click", onOpenOutputNewTab);
  }

  async function onFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      state.sourceFileName = file.name || "";
      const text = await file.text();
      els.sourceText.value = text;
      state.sourceText = text;
      setOutputStatus("File loaded. Click Analyze and detect format.", "ok");
    } catch (err) {
      setOutputStatus("Could not read the file in the browser. Try copy-paste instead.", "error");
      console.error(err);
    }
  }

  async function onPasteFromClipboard() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      setOutputStatus("Clipboard read is not available in this browser. Paste manually into the input box.", "warn");
      els.sourceText.focus();
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        setOutputStatus("Clipboard is empty or browser denied clipboard text.", "warn");
        return;
      }
      els.sourceText.value = text;
      state.sourceText = text;
      setOutputStatus("Clipboard text pasted. Click Analyze and detect format.", "ok");
    } catch (err) {
      setOutputStatus("Clipboard access was blocked. Paste manually into the input box.", "warn");
      els.sourceText.focus();
    }
  }

  function onClear() {
    if (els.fileInput) els.fileInput.value = "";
    els.sourceText.value = "";
    els.outputText.value = "";
    els.downloadName.value = "";
    state.sourceFileName = "";
    state.sourceText = "";
    state.analysis = null;
    state.fixedInputText = "";
    state.outputText = "";
    hideAnalysis();
    setOutputStatus("Cleared. Paste or upload subtitle content.", "ok");
    updateTextTimingOptionsVisibility();
  }

  function onAnalyze() {
    const input = els.sourceText.value || "";
    state.sourceText = input;

    if (!input.trim()) {
      setOutputStatus("Please paste subtitle content or upload a file first.", "warn");
      return;
    }

    const analysis = analyzeSubtitleInput(input, state.sourceFileName);
    state.analysis = analysis;
    state.fixedInputText = analysis.normalizedSourceText || "";
    renderAnalysis(analysis);

    if (analysis.hasFixableIssues) {
      setOutputStatus("Format detected. Issues found. You can apply a recommended fix before converting.", "warn");
    } else {
      setOutputStatus("Format detected. No major compatibility issues found.", "ok");
    }

    updateTextTimingOptionsVisibility();
  }

  function onApplyFixes() {
    if (!state.analysis || !state.fixedInputText) {
      setOutputStatus("No fix is available. Analyze the input first.", "warn");
      return;
    }

    els.sourceText.value = state.fixedInputText;
    state.sourceText = state.fixedInputText;

    setOutputStatus("Recommended fixes applied to the input. Analyze again or convert now.", "ok");

    const analysis = analyzeSubtitleInput(state.sourceText, state.sourceFileName);
    state.analysis = analysis;
    state.fixedInputText = analysis.normalizedSourceText || "";
    renderAnalysis(analysis);
    updateTextTimingOptionsVisibility();
  }

  function onConvert() {
    const input = els.sourceText.value || "";
    if (!input.trim()) {
      setOutputStatus("Please paste subtitle content or upload a file first.", "warn");
      return;
    }

    let analysis = state.analysis;
    if (!analysis || analysis.originalText !== input) {
      analysis = analyzeSubtitleInput(input, state.sourceFileName);
      state.analysis = analysis;
      state.fixedInputText = analysis.normalizedSourceText || "";
      renderAnalysis(analysis);
    }

    const target = els.targetFormat.value;
    const options = getConversionOptionsFromUI();
    state.outputFormat = target;

    try {
      const result = convertAnalysisToTarget(analysis, target, options);
      els.outputText.value = result.text;
      state.outputText = result.text;

      const notices = [];
      if (result.notices.length) {
        notices.push(...result.notices);
      }
      if (result.losses.length) {
        notices.push("Compatibility changes: " + result.losses.join(" | "));
      }

      if (notices.length) {
        setOutputStatus(notices.join(" "), "warn");
      } else {
        setOutputStatus("Conversion completed successfully.", "ok");
      }
    } catch (err) {
      console.error(err);
      setOutputStatus("Conversion failed. The input may be too damaged to recover automatically.", "error");
    }
  }

  function onSwapInputWithOutput() {
    const out = els.outputText.value || "";
    if (!out.trim()) {
      setOutputStatus("No output available yet.", "warn");
      return;
    }
    els.sourceText.value = out;
    state.sourceText = out;
    state.sourceFileName = "";
    state.analysis = null;
    state.fixedInputText = "";
    hideAnalysis();
    setOutputStatus("Output moved into input. Click Analyze and detect format.", "ok");
    updateTextTimingOptionsVisibility();
  }

  function onDownloadOutput() {
    const out = els.outputText.value || "";
    if (!out.trim()) {
      setOutputStatus("No output to download.", "warn");
      return;
    }

    const target = els.targetFormat.value;
    const ext = target === "text" ? "txt" : target;
    const filename = buildOutputFileName(ext);

    const blob = new Blob([out], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setOutputStatus("Download started: " + filename, "ok");
    } catch (err) {
      setOutputStatus("Download could not start. Use Copy output or Open output in new tab.", "warn");
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  }

  async function onCopyOutput() {
    const out = els.outputText.value || "";
    if (!out.trim()) {
      setOutputStatus("No output to copy.", "warn");
      return;
    }

    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      try {
        els.outputText.focus();
        els.outputText.select();
        const ok = document.execCommand("copy");
        setOutputStatus(ok ? "Output copied." : "Copy failed. Select and copy manually.", ok ? "ok" : "warn");
      } catch (err) {
        setOutputStatus("Copy is not supported. Select and copy manually.", "warn");
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(out);
      setOutputStatus("Output copied to clipboard.", "ok");
    } catch (err) {
      setOutputStatus("Clipboard write was blocked. Select and copy manually.", "warn");
    }
  }

  function onOpenOutputNewTab() {
    const out = els.outputText.value || "";
    if (!out.trim()) {
      setOutputStatus("No output available.", "warn");
      return;
    }

    const blob = new Blob([out], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");

    setTimeout(() => URL.revokeObjectURL(url), 10000);
    setOutputStatus("Opened output in a new tab.", "ok");
  }

  function buildOutputFileName(ext) {
    const custom = (els.downloadName.value || "").trim();
    if (custom) {
      return custom.toLowerCase().endsWith("." + ext) ? custom : custom + "." + ext;
    }

    const base = guessBaseName(state.sourceFileName) || "subtitle-converted";
    return base + "." + ext;
  }

  function guessBaseName(fileName) {
    if (!fileName) return "";
    const idx = fileName.lastIndexOf(".");
    if (idx <= 0) return fileName;
    return fileName.slice(0, idx) + "-converted";
  }

  function getConversionOptionsFromUI() {
    return {
      simplifyFormatting: !!els.optSimplify.checked,
      repair: !!els.optRepair.checked,
      stripVttSettingsWhenNotVtt: !!els.optStripVttSettings.checked,
      normalizeLineEndings: !!els.optNormalizeLineEndings.checked,
      textGeneration: {
        startTime: (els.genStartTime.value || "00:00:00.000").trim(),
        secondsPerBlock: parseFloat(els.genSecondsPerBlock.value || "3")
      }
    };
  }

  function updateTextTimingOptionsVisibility() {
    const target = els.targetFormat ? els.targetFormat.value : "srt";
    const input = els.sourceText ? els.sourceText.value : "";
    const quickDetected = input.trim() ? detectFormat(input, state.sourceFileName) : { format: "unknown" };
    const show = quickDetected.format === "text" && target !== "text";
    els.textTimingOptions.classList.toggle("hidden", !show);
  }

  function hideAnalysis() {
    els.analysisPanel.classList.add("hidden");
    els.issuesWrap.classList.add("hidden");
    els.issuesList.innerHTML = "";
  }

  function renderAnalysis(analysis) {
    els.analysisPanel.classList.remove("hidden");

    els.detectedFormat.textContent = formatLabel(analysis.detected.format);
    els.detectedConfidence.textContent = Math.round(analysis.detected.confidence * 100) + "%";
    els.sourceFilename.textContent = state.sourceFileName || "(pasted text)";
    els.sourceExtension.textContent = analysis.fileExtension || "(none)";
    els.cueCount.textContent = String(analysis.doc.cues.length);

    const fixableCount = analysis.issues.filter((x) => x.fixable).length;
    const errorCount = analysis.issues.filter((x) => x.level === "error").length;
    const warnCount = analysis.issues.filter((x) => x.level === "warn").length;

    if (analysis.issues.length === 0) {
      els.repairSummary.textContent = "No major issues detected";
      els.issuesWrap.classList.add("hidden");
      els.applyFixesBtn.disabled = true;
      return;
    }

    els.repairSummary.textContent =
      analysis.hasFixableIssues
        ? "Issues found. Recommended fix is available."
        : "Issues found. Some may need manual review.";

    els.issuesWrap.classList.remove("hidden");
    els.issuesList.innerHTML = "";

    analysis.issues.forEach((issue) => {
      const li = document.createElement("li");
      li.className = issue.level === "error" ? "status-error" : issue.level === "warn" ? "status-warn" : "";
      li.textContent =
        "[" + issue.level.toUpperCase() + "] " +
        issue.message +
        (issue.fixable ? " (fixable)" : "");
      els.issuesList.appendChild(li);
    });

    if (analysis.mismatchNote) {
      const li = document.createElement("li");
      li.className = "status-warn";
      li.textContent = "[WARN] " + analysis.mismatchNote;
      els.issuesList.appendChild(li);
    }

    if (analysis.detected.reasons.length) {
      const li = document.createElement("li");
      li.textContent = "[INFO] Detection notes: " + analysis.detected.reasons.join(" | ");
      els.issuesList.appendChild(li);
    }

    els.applyFixesBtn.disabled = !analysis.hasFixableIssues;

    if (errorCount > 0 || warnCount > 0 || fixableCount > 0) {
      // no-op, already visible
    }
  }

  function setOutputStatus(message, kind) {
    const box = els.outputStatus;
    if (!box) return;
    box.classList.remove("hidden", "status-ok", "status-warn", "status-error");

    const cls = kind === "error" ? "status-error" : kind === "warn" ? "status-warn" : "status-ok";
    box.classList.add(cls);

    box.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = message;
    box.appendChild(p);
  }

  function formatLabel(fmt) {
    switch (fmt) {
      case "srt": return "SRT";
      case "vtt": return "WebVTT (VTT)";
      case "sbv": return "SBV";
      case "text": return "Plain text";
      default: return "Unknown";
    }
  }

  function analyzeSubtitleInput(rawText, fileName) {
    const originalText = normalizeNewlines(rawText);
    const fileExtension = getExtension(fileName);

    const detected = detectFormat(originalText, fileName);

    let doc;
    if (detected.format === "srt") doc = parseSrt(originalText);
    else if (detected.format === "vtt") doc = parseVtt(originalText);
    else if (detected.format === "sbv") doc = parseSbv(originalText);
    else doc = parsePlainText(originalText);

    const mismatchNote = buildMismatchNote(fileExtension, detected.format);

    const issues = [...doc.issues];
    if (/\uFFFD/.test(originalText)) {
      issues.push({
        level: "warn",
        fixable: false,
        message: "Replacement character found ( ). This may indicate encoding damage before the file reached the browser."
      });
    }

    const normalizedDoc = normalizeDocument(doc, {
      repair: true,
      simplifyFormatting: true,
      stripVttSettingsWhenNotVtt: true,
      targetFormat: doc.format
    });

    const normalizedSourceText = renderDocument(normalizedDoc, doc.format, {
      simplifyFormatting: true,
      stripVttSettingsWhenNotVtt: true,
      normalizeLineEndings: true
    });

    const hasFixableIssues = issues.some((x) => x.fixable);

    return {
      originalText,
      fileExtension,
      detected,
      doc,
      normalizedDoc,
      normalizedSourceText,
      issues,
      hasFixableIssues,
      mismatchNote
    };
  }

  function buildMismatchNote(fileExtension, detectedFormat) {
    if (!fileExtension || !detectedFormat) return "";
    const map = {
      srt: "srt",
      vtt: "vtt",
      sbv: "sbv",
      txt: "text",
      text: "text"
    };
    const extFmt = map[fileExtension] || "";
    if (!extFmt) return "";
    if (extFmt === detectedFormat) return "";
    return "File extension suggests " + formatLabel(extFmt) + " but content looks like " + formatLabel(detectedFormat) + ".";
  }

  function getExtension(fileName) {
    if (!fileName || typeof fileName !== "string") return "";
    const idx = fileName.lastIndexOf(".");
    if (idx < 0) return "";
    return fileName.slice(idx + 1).trim().toLowerCase();
  }

  function detectFormat(text, fileName) {
    const t = normalizeNewlines(text);
    const trimmed = t.trim();
    const reasons = [];

    if (!trimmed) {
      return { format: "text", confidence: 0.2, reasons: ["Empty input"] };
    }

    let scores = {
      srt: 0,
      vtt: 0,
      sbv: 0,
      text: 0
    };

    const lines = t.split("\n");
    const nonEmptyLines = lines.filter((l) => l.trim() !== "");
    const firstNonEmpty = nonEmptyLines[0] || "";

    if (/^\uFEFF?WEBVTT(\s|$)/i.test(firstNonEmpty)) {
      scores.vtt += 100;
      reasons.push("WEBVTT header found");
    }

    const arrowLines = lines.filter((l) => l.includes("-->"));
    const sbvTimeLines = lines.filter((l) => isSbvTimeLine(l));
    const srtTimeLines = lines.filter((l) => isSrtTimeLineLike(l));
    const vttTimeLines = lines.filter((l) => isVttTimeLineLike(l));
    const numericLines = lines.filter((l) => /^\s*\d+\s*$/.test(l)).length;

    if (arrowLines.length > 0) {
      scores.srt += 20;
      scores.vtt += 20;
      reasons.push("Cue arrow timing lines found");
    }

    if (srtTimeLines.length > 0) {
      scores.srt += 40 + srtTimeLines.length;
      reasons.push("SRT-like comma timestamps found");
    }

    if (vttTimeLines.length > 0) {
      scores.vtt += 35 + vttTimeLines.length;
      reasons.push("VTT-like dot timestamps found");
    }

    if (sbvTimeLines.length > 0) {
      scores.sbv += 60 + sbvTimeLines.length * 2;
      reasons.push("SBV timing lines found");
    }

    if (numericLines > 0 && arrowLines.length > 0) {
      scores.srt += 10;
      reasons.push("Numeric cue numbering lines found");
    }

    if (/^\s*NOTE\b/m.test(t) || /^\s*STYLE\b/m.test(t) || /^\s*REGION\b/m.test(t)) {
      scores.vtt += 20;
      reasons.push("VTT block keywords found");
    }

    if (arrowLines.length === 0 && sbvTimeLines.length === 0) {
      scores.text += 30;
    }

    // Extension hint, low weight
    const ext = getExtension(fileName);
    if (ext === "srt") scores.srt += 5;
    if (ext === "vtt") scores.vtt += 5;
    if (ext === "sbv") scores.sbv += 5;
    if (ext === "txt") scores.text += 5;

    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const best = entries[0][0];
    const bestScore = entries[0][1];
    const secondScore = entries[1][1];

    let confidence = 0.5;
    if (bestScore <= 0) confidence = 0.2;
    else if (bestScore >= 100) confidence = 0.99;
    else confidence = Math.max(0.35, Math.min(0.98, 0.5 + (bestScore - secondScore) / 100));

    return { format: best, confidence, reasons };
  }

  function isSrtTimeLineLike(line) {
    if (!line.includes("-->")) return false;
    return /,(\d{1,3})/.test(line);
  }

  function isVttTimeLineLike(line) {
    if (!line.includes("-->")) return false;
    return /\.(\d{1,3})/.test(line);
  }

  function isSbvTimeLine(line) {
    const s = line.trim();
    const parts = s.split(",");
    if (parts.length !== 2) return false;
    return !!parseFlexibleTimestamp(parts[0]) && !!parseFlexibleTimestamp(parts[1]);
  }

  function parseSrt(text) {
    const lines = normalizeNewlines(text).split("\n");
    const issues = [];
    const cues = [];
    let i = 0;
    let expectedIndex = 1;
    let missingNumbers = 0;
    let malformedBlocks = 0;
    let dotFractionSrtCount = 0;

    while (i < lines.length) {
      while (i < lines.length && lines[i].trim() === "") i++;
      if (i >= lines.length) break;

      let cueNumber = null;
      let timingLineIndex = i;

      if (/^\d+$/.test(lines[i].trim())) {
        cueNumber = parseInt(lines[i].trim(), 10);
        i++;
        timingLineIndex = i;
      } else {
        missingNumbers++;
      }

      if (i >= lines.length) break;

      if (!lines[i].includes("-->")) {
        // loose recovery: scan ahead to find a timing line before next blank block
        let found = -1;
        let j = i;
        while (j < lines.length && lines[j].trim() !== "") {
          if (lines[j].includes("-->")) {
            found = j;
            break;
          }
          j++;
        }

        if (found === -1) {
          malformedBlocks++;
          i = j + 1;
          continue;
        }

        issues.push({
          level: "warn",
          fixable: true,
          message: "SRT block had text before timing line. Recovered by moving parser to the first timing line."
        });
        i = found;
      }

      const timingLine = lines[i];
      if (/\d+\.\d+\s*-->\s*\d+\.\d+/.test(timingLine) || /\.\d{1,3}\s*-->/.test(timingLine)) {
        dotFractionSrtCount++;
      }

      const parsedRange = parseArrowTimeRange(timingLine);
      if (!parsedRange) {
        malformedBlocks++;
        issues.push({
          level: "error",
          fixable: false,
          message: "Could not parse SRT timing line near line " + (timingLineIndex + 1) + "."
        });

        // skip until blank
        while (i < lines.length && lines[i].trim() !== "") i++;
        continue;
      }

      i++;

      const textLines = [];
      while (i < lines.length && lines[i].trim() !== "") {
        textLines.push(lines[i]);
        i++;
      }

      cues.push({
        id: cueNumber != null ? String(cueNumber) : null,
        index: cueNumber,
        startMs: parsedRange.startMs,
        endMs: parsedRange.endMs,
        textLines,
        settings: {},
        metaBlocks: []
      });

      if (cueNumber != null && cueNumber !== expectedIndex) {
        issues.push({
          level: "info",
          fixable: true,
          message: "Cue numbering is not sequential. Output can be renumbered."
        });
      }
      expectedIndex++;
    }

    if (missingNumbers > 0) {
      issues.push({
        level: "warn",
        fixable: true,
        message: "One or more SRT cue numbers are missing. Most players accept this, but renumbering improves compatibility."
      });
    }

    if (dotFractionSrtCount > 0) {
      issues.push({
        level: "warn",
        fixable: true,
        message: "SRT file contains dot fractions in timestamps. Canonical SRT uses comma milliseconds."
      });
    }

    if (malformedBlocks > 0) {
      issues.push({
        level: "warn",
        fixable: malformedBlocks < 5,
        message: "Some SRT blocks were malformed or skipped during parsing."
      });
    }

    return {
      format: "srt",
      cues,
      meta: {},
      issues
    };
  }

  function parseVtt(text) {
    const lines = normalizeNewlines(text).split("\n");
    const issues = [];
    const cues = [];
    const metaBlocks = [];
    let i = 0;

    while (i < lines.length && lines[i].trim() === "") i++;

    if (i >= lines.length) {
      return {
        format: "vtt",
        cues: [],
        meta: { metaBlocks: [] },
        issues: [{
          level: "warn",
          fixable: true,
          message: "Empty VTT input."
        }]
      };
    }

    let hasHeader = false;
    if (/^\uFEFF?WEBVTT(\s|$)/i.test(lines[i])) {
      hasHeader = true;
      i++;
    } else {
      issues.push({
        level: "warn",
        fixable: true,
        message: "WebVTT header is missing. A valid VTT file should start with WEBVTT."
      });
    }

    // Collect leading NOTE / STYLE / REGION blocks
    while (i < lines.length) {
      while (i < lines.length && lines[i].trim() === "") i++;
      if (i >= lines.length) break;

      const line = lines[i].trim();
      if (!/^(NOTE|STYLE|REGION)\b/.test(line)) break;

      const block = [];
      while (i < lines.length && lines[i].trim() !== "") {
        block.push(lines[i]);
        i++;
      }
      metaBlocks.push(block.join("\n"));

      if (/^STYLE\b/.test(line) || /^REGION\b/.test(line)) {
        issues.push({
          level: "info",
          fixable: false,
          message: "VTT contains " + line.split(/\s+/)[0] + " block. This may be dropped in SRT or SBV conversion."
        });
      }
    }

    while (i < lines.length) {
      while (i < lines.length && lines[i].trim() === "") i++;
      if (i >= lines.length) break;

      const block = [];
      while (i < lines.length && lines[i].trim() !== "") {
        block.push(lines[i]);
        i++;
      }

      if (!block.length) continue;

      const first = block[0].trim();
      if (/^NOTE\b/.test(first)) {
        // comment block anywhere
        continue;
      }
      if (/^(STYLE|REGION)\b/.test(first)) {
        metaBlocks.push(block.join("\n"));
        issues.push({
          level: "info",
          fixable: false,
          message: "VTT contains " + first.split(/\s+/)[0] + " block. This may be dropped in other formats."
        });
        continue;
      }

      let id = null;
      let timingLine = block[0];
      let payloadStart = 1;

      if (!block[0].includes("-->")) {
        if (block.length >= 2 && block[1].includes("-->")) {
          id = block[0];
          timingLine = block[1];
          payloadStart = 2;
        } else {
          issues.push({
            level: "error",
            fixable: false,
            message: "Unparseable VTT cue block found (missing timing line)."
          });
          continue;
        }
      }

      const parsed = parseArrowTimeRange(timingLine, true);
      if (!parsed) {
        issues.push({
          level: "error",
          fixable: false,
          message: "Invalid VTT timing line: " + timingLine.trim()
        });
        continue;
      }

      if (parsed.usedCommaFraction) {
        issues.push({
          level: "warn",
          fixable: true,
          message: "VTT timing line uses comma fractions. WebVTT should use dot fractions."
        });
      }

      if (parsed.settingsText) {
        // Keep raw settings but validate lightly
        const invalid = getInvalidVttSettingsTokens(parsed.settingsText);
        if (invalid.length) {
          issues.push({
            level: "warn",
            fixable: true,
            message: "VTT cue contains invalid or nonstandard setting tokens: " + invalid.join(", ")
          });
        }
      }

      cues.push({
        id,
        index: null,
        startMs: parsed.startMs,
        endMs: parsed.endMs,
        textLines: block.slice(payloadStart),
        settings: parsed.settings || {},
        rawSettingsText: parsed.settingsText || "",
        metaBlocks: []
      });
    }

    return {
      format: "vtt",
      cues,
      meta: {
        hasHeader,
        metaBlocks
      },
      issues
    };
  }

  function parseSbv(text) {
    const lines = normalizeNewlines(text).split("\n");
    const blocks = splitBlocks(lines);
    const issues = [];
    const cues = [];
    let skipped = 0;

    for (const block of blocks) {
      if (!block.length) continue;

      const timingLine = block[0].trim();
      if (!isSbvTimeLine(timingLine)) {
        skipped++;
        continue;
      }

      const parts = timingLine.split(",");
      const start = parseFlexibleTimestamp(parts[0]);
      const end = parseFlexibleTimestamp(parts[1]);

      if (!start || !end) {
        skipped++;
        issues.push({
          level: "error",
          fixable: false,
          message: "Invalid SBV timing line: " + timingLine
        });
        continue;
      }

      cues.push({
        id: null,
        index: null,
        startMs: start.ms,
        endMs: end.ms,
        textLines: block.slice(1),
        settings: {},
        metaBlocks: []
      });
    }

    if (skipped > 0) {
      issues.push({
        level: "warn",
        fixable: false,
        message: "Some blocks were skipped because they did not match SBV timing syntax."
      });
    }

    return {
      format: "sbv",
      cues,
      meta: {},
      issues
    };
  }

  function parsePlainText(text) {
    const normalized = normalizeNewlines(text);
    const lines = normalized.split("\n");
    const blocks = splitBlocks(lines);

    const paragraphs = [];
    for (const b of blocks) {
      const cleaned = b.map((x) => x.replace(/\r/g, "")).filter((x) => x.length > 0);
      if (cleaned.length) paragraphs.push(cleaned);
    }

    if (!paragraphs.length && normalized.trim()) {
      paragraphs.push([normalized.trim()]);
    }

    return {
      format: "text",
      cues: paragraphs.map((textLines, idx) => ({
        id: null,
        index: idx + 1,
        startMs: 0,
        endMs: 0,
        textLines,
        settings: {},
        metaBlocks: []
      })),
      meta: {},
      issues: [{
        level: "info",
        fixable: false,
        message: "Plain text detected. Timed subtitle conversion will generate synthetic timings per block."
      }]
    };
  }

  function normalizeDocument(doc, options) {
    const repair = !!options.repair;
    const targetFormat = options.targetFormat || doc.format;
    const simplifyFormatting = !!options.simplifyFormatting;
    const stripVttSettingsWhenNotVtt = !!options.stripVttSettingsWhenNotVtt;

    const cloned = {
      format: doc.format,
      cues: doc.cues.map(cloneCue),
      meta: deepClone(doc.meta || {}),
      issues: [...(doc.issues || [])]
    };

    // Timing repairs and ordering checks
    let wasOutOfOrder = false;
    for (let i = 1; i < cloned.cues.length; i++) {
      if (cloned.cues[i].startMs < cloned.cues[i - 1].startMs) {
        wasOutOfOrder = true;
        break;
      }
    }
    if (wasOutOfOrder) {
      cloned.issues.push({
        level: "warn",
        fixable: true,
        message: "Cues are out of chronological order."
      });
      if (repair) {
        cloned.cues.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
      }
    }

    for (let i = 0; i < cloned.cues.length; i++) {
      const cue = cloned.cues[i];

      if (repair && cue.endMs < cue.startMs) {
        const tmp = cue.startMs;
        cue.startMs = cue.endMs;
        cue.endMs = tmp;
      }

      if (repair && cue.endMs === cue.startMs) {
        cue.endMs = cue.startMs + 500;
      }

      if (repair && i > 0) {
        const prev = cloned.cues[i - 1];
        if (prev.endMs > cue.startMs) {
          // conservative fix: clip previous end
          prev.endMs = Math.max(prev.startMs + 1, cue.startMs);
        }
      }

      if (simplifyFormatting) {
        cue.textLines = simplifyCueTextLines(cue.textLines, targetFormat);
      }

      if (doc.format === "vtt" && targetFormat !== "vtt" && stripVttSettingsWhenNotVtt) {
        cue.settings = {};
        cue.rawSettingsText = "";
      }

      // Normalize empty payload lines
      if (!cue.textLines || !cue.textLines.length) {
        cue.textLines = [""];
      }
    }

    return cloned;
  }

  function convertAnalysisToTarget(analysis, targetFormat, options) {
    const notices = [];
    const losses = [];

    let workingDoc = normalizeDocument(analysis.doc, {
      repair: options.repair,
      simplifyFormatting: options.simplifyFormatting,
      stripVttSettingsWhenNotVtt: options.stripVttSettingsWhenNotVtt,
      targetFormat
    });

    if (analysis.doc.format === "vtt" && targetFormat !== "vtt") {
      if ((analysis.doc.meta && analysis.doc.meta.metaBlocks && analysis.doc.meta.metaBlocks.length) || hasVttAdvancedFeatures(analysis.doc)) {
        losses.push("VTT metadata blocks, cue settings, or advanced semantics may be removed");
      }
    }

    if (targetFormat === "text") {
      const text = renderPlainTextFromDoc(workingDoc);
      return {
        text: finalizeLineEndings(text, options.normalizeLineEndings),
        notices,
        losses
      };
    }

    if (analysis.doc.format === "text") {
      const generated = generateTimedDocFromPlainText(workingDoc, targetFormat, options.textGeneration);
      workingDoc = normalizeDocument(generated, {
        repair: true,
        simplifyFormatting: options.simplifyFormatting,
        stripVttSettingsWhenNotVtt: options.stripVttSettingsWhenNotVtt,
        targetFormat
      });
      notices.push("Generated simple timings from plain text blocks.");
    }

    const rendered = renderDocument(workingDoc, targetFormat, {
      simplifyFormatting: options.simplifyFormatting,
      stripVttSettingsWhenNotVtt: options.stripVttSettingsWhenNotVtt,
      normalizeLineEndings: options.normalizeLineEndings
    });

    return {
      text: rendered,
      notices,
      losses
    };
  }

  function hasVttAdvancedFeatures(doc) {
    if (!doc || doc.format !== "vtt") return false;
    if (doc.meta && doc.meta.metaBlocks && doc.meta.metaBlocks.length) return true;
    return doc.cues.some((c) => {
      if (c.rawSettingsText && c.rawSettingsText.trim()) return true;
      return c.textLines.some((line) => /<c(\.| )|<v\s|<lang\s|<ruby>|<rt>|<\d{2}:\d{2}(?::\d{2})?\.\d{3}>/i.test(line));
    });
  }

  function renderDocument(doc, targetFormat, options) {
    switch (targetFormat) {
      case "srt":
        return finalizeLineEndings(renderSrt(doc, options), options.normalizeLineEndings);
      case "vtt":
        return finalizeLineEndings(renderVtt(doc, options), options.normalizeLineEndings);
      case "sbv":
        return finalizeLineEndings(renderSbv(doc, options), options.normalizeLineEndings);
      case "text":
        return finalizeLineEndings(renderPlainTextFromDoc(doc), options.normalizeLineEndings);
      default:
        throw new Error("Unsupported target format: " + targetFormat);
    }
  }

  function renderSrt(doc) {
    const out = [];
    for (let i = 0; i < doc.cues.length; i++) {
      const cue = doc.cues[i];
      out.push(String(i + 1));
      out.push(formatSrtTime(cue.startMs) + " --> " + formatSrtTime(cue.endMs));
      const lines = cue.textLines && cue.textLines.length ? cue.textLines : [""];
      for (const line of lines) out.push(line);
      out.push("");
    }
    return out.join("\n").replace(/\n+$/, "\n");
  }

  function renderVtt(doc) {
    const out = [];
    out.push("WEBVTT");
    out.push("");

    for (let i = 0; i < doc.cues.length; i++) {
      const cue = doc.cues[i];

      if (cue.id && !/-->/.test(cue.id)) {
        out.push(cue.id);
      }

      let timing = formatVttTime(cue.startMs) + " --> " + formatVttTime(cue.endMs);
      if (cue.rawSettingsText && cue.rawSettingsText.trim()) {
        const cleaned = normalizeVttSettingsText(cue.rawSettingsText);
        if (cleaned) timing += " " + cleaned;
      }
      out.push(timing);

      const lines = cue.textLines && cue.textLines.length ? cue.textLines : [""];
      for (const line of lines) out.push(line);
      out.push("");
    }

    return out.join("\n").replace(/\n+$/, "\n");
  }

  function renderSbv(doc) {
    const out = [];
    for (let i = 0; i < doc.cues.length; i++) {
      const cue = doc.cues[i];
      out.push(formatSbvTime(cue.startMs) + "," + formatSbvTime(cue.endMs));
      const lines = cue.textLines && cue.textLines.length ? cue.textLines : [""];
      for (const line of lines) out.push(line);
      out.push("");
    }
    return out.join("\n").replace(/\n+$/, "\n");
  }

  function renderPlainTextFromDoc(doc) {
    const out = [];
    for (let i = 0; i < doc.cues.length; i++) {
      const cue = doc.cues[i];
      const lines = cue.textLines && cue.textLines.length ? cue.textLines : [""];
      out.push(lines.join("\n"));
      if (i < doc.cues.length - 1) out.push("");
    }
    return out.join("\n").replace(/\n+$/, "\n");
  }

  function generateTimedDocFromPlainText(doc, targetFormat, textGeneration) {
    const startParsed = parseFlexibleTimestamp((textGeneration && textGeneration.startTime) || "00:00:00.000");
    const startMs = startParsed ? startParsed.ms : 0;

    let secondsPerBlock = Number((textGeneration && textGeneration.secondsPerBlock) || 3);
    if (!Number.isFinite(secondsPerBlock) || secondsPerBlock <= 0) secondsPerBlock = 3;

    let cursor = startMs;

    const cues = doc.cues.map((cue, idx) => {
      const lineCount = Math.max(1, (cue.textLines || []).length);
      const durationMs = Math.max(1000, Math.round(secondsPerBlock * 1000 * Math.max(1, Math.min(4, lineCount))));
      const start = cursor;
      const end = start + durationMs;
      cursor = end;

      return {
        id: null,
        index: idx + 1,
        startMs: start,
        endMs: end,
        textLines: cue.textLines && cue.textLines.length ? cue.textLines : [""],
        settings: {},
        rawSettingsText: ""
      };
    });

    return {
      format: targetFormat,
      cues,
      meta: {},
      issues: [{
        level: "info",
        fixable: false,
        message: "Synthetic timings generated from plain text."
      }]
    };
  }

  function cloneCue(cue) {
    return {
      id: cue.id == null ? null : String(cue.id),
      index: cue.index == null ? null : cue.index,
      startMs: cue.startMs,
      endMs: cue.endMs,
      textLines: Array.isArray(cue.textLines) ? cue.textLines.slice() : [""],
      settings: deepClone(cue.settings || {}),
      rawSettingsText: cue.rawSettingsText || "",
      metaBlocks: Array.isArray(cue.metaBlocks) ? cue.metaBlocks.slice() : []
    };
  }

  function deepClone(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (err) {
      return {};
    }
  }

  function simplifyCueTextLines(lines, targetFormat) {
    if (!Array.isArray(lines)) return [""];
    const out = [];

    for (let rawLine of lines) {
      let line = String(rawLine);

      // Normalize HTML line breaks used by some subtitle tools
      line = line.replace(/<br\s*\/?>/gi, "\n").replace(/\\N/g, "\n");

      const split = line.split("\n");
      for (let part of split) {
        // Strip VTT internal timestamps from text payload
        part = part.replace(/<\d{2}:\d{2}(?::\d{2})?\.\d{3}>/g, "");

        if (targetFormat === "text" || targetFormat === "sbv" || targetFormat === "srt") {
          // Convert VTT voice tags into a readable prefix if possible
          part = part.replace(/<v\s+([^>]+)>/gi, (_m, speaker) => {
            const cleanSpeaker = String(speaker || "").trim();
            return cleanSpeaker ? cleanSpeaker + ": " : "";
          });

          // Remove tags that are often unsupported or inconsistent
          part = part.replace(/<\/?(c(\.[^>]+)?|lang\b[^>]*|ruby|rt|u|i|b)\b[^>]*>/gi, "");
          part = part.replace(/<[^>]+>/g, "");
        } else if (targetFormat === "vtt") {
          // Keep text content, but simplify non-basic HTML / legacy font tags
          part = part.replace(/<font\b[^>]*>/gi, "").replace(/<\/font>/gi, "");
        }

        out.push(part);
      }
    }

    return out.length ? out : [""];
  }

  function splitBlocks(lines) {
    const blocks = [];
    let current = [];
    for (const line of lines) {
      if (line.trim() === "") {
        if (current.length) {
          blocks.push(current);
          current = [];
        }
      } else {
        current.push(line);
      }
    }
    if (current.length) blocks.push(current);
    return blocks;
  }

  function parseArrowTimeRange(line, allowVttSettings) {
    const s = line.trim();
    const m = s.match(/^(.+?)\s*-->\s*(.+)$/);
    if (!m) return null;

    const left = m[1].trim();
    let rightPart = m[2].trim();

    let settingsText = "";
    let endTimeCandidate = rightPart;

    if (allowVttSettings) {
      // Extract first token as end timestamp, rest as settings
      const spaceIdx = rightPart.search(/\s/);
      if (spaceIdx >= 0) {
        endTimeCandidate = rightPart.slice(0, spaceIdx).trim();
        settingsText = rightPart.slice(spaceIdx).trim();
      }
    }

    const leftParsed = parseFlexibleTimestamp(left);
    const rightParsed = parseFlexibleTimestamp(endTimeCandidate);

    if (!leftParsed || !rightParsed) return null;

    const settings = allowVttSettings ? parseVttSettings(settingsText) : {};

    return {
      startMs: leftParsed.ms,
      endMs: rightParsed.ms,
      usedCommaFraction: !!(leftParsed.usedCommaFraction || rightParsed.usedCommaFraction),
      settingsText,
      settings
    };
  }

  function parseFlexibleTimestamp(input) {
    if (input == null) return null;

    let s = String(input).trim();
    if (!s) return null;

    // Keep only the first timestamp-like token in loose parsing
    const tokenMatch = s.match(/^\d{1,3}:\d{1,2}(?::\d{1,2})?[.,]\d{1,3}$/) ||
      s.match(/^\d{1,2}:\d{1,2}[.,]\d{1,3}$/);
    if (!tokenMatch) {
      // Try trimming trailing junk
      const loose = s.match(/^\d{1,3}:\d{1,2}(?::\d{1,2})?[.,]\d{1,3}/) ||
        s.match(/^\d{1,2}:\d{1,2}[.,]\d{1,3}/);
      if (!loose) return null;
      s = loose[0];
    }

    const usedCommaFraction = s.includes(",");
    s = s.replace(",", ".");

    const parts = s.split(":");
    let h = 0;
    let m = 0;
    let secPart = "";

    if (parts.length === 3) {
      h = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
      secPart = parts[2];
    } else if (parts.length === 2) {
      h = 0;
      m = parseInt(parts[0], 10);
      secPart = parts[1];
    } else {
      return null;
    }

    const secParts = secPart.split(".");
    if (secParts.length !== 2) return null;

    let sec = parseInt(secParts[0], 10);
    let msStr = secParts[1].replace(/[^\d]/g, "");
    if (msStr.length === 0) return null;
    if (msStr.length === 1) msStr = msStr + "00";
    else if (msStr.length === 2) msStr = msStr + "0";
    else if (msStr.length > 3) msStr = msStr.slice(0, 3);

    const ms = parseInt(msStr, 10);

    if (![h, m, sec, ms].every(Number.isFinite)) return null;
    if (m < 0 || sec < 0 || ms < 0) return null;

    const total = ((h * 60 + m) * 60 + sec) * 1000 + ms;
    return { ms: total, usedCommaFraction };
  }

  function parseVttSettings(settingsText) {
    const settings = {};
    if (!settingsText) return settings;

    const tokens = settingsText.trim().split(/\s+/).filter(Boolean);
    for (const tok of tokens) {
      const idx = tok.indexOf(":");
      if (idx <= 0) continue;
      const key = tok.slice(0, idx).trim();
      const value = tok.slice(idx + 1).trim();
      if (!key || !value) continue;
      settings[key] = value;
    }
    return settings;
  }

  function getInvalidVttSettingsTokens(settingsText) {
    if (!settingsText) return [];
    const tokens = settingsText.trim().split(/\s+/).filter(Boolean);
    const allowed = new Set(["vertical", "line", "position", "size", "align", "region"]);
    const invalid = [];
    for (const tok of tokens) {
      const idx = tok.indexOf(":");
      if (idx <= 0) {
        invalid.push(tok);
        continue;
      }
      const key = tok.slice(0, idx);
      if (!allowed.has(key)) invalid.push(tok);
    }
    return invalid;
  }

  function normalizeVttSettingsText(settingsText) {
    const settings = parseVttSettings(settingsText);
    const order = ["region", "vertical", "line", "position", "size", "align"];
    const parts = [];
    for (const key of order) {
      if (settings[key]) parts.push(key + ":" + settings[key]);
    }
    return parts.join(" ");
  }

  function formatSrtTime(ms) {
    const { h, m, s, msPart } = msToParts(ms);
    return pad2(h) + ":" + pad2(m) + ":" + pad2(s) + "," + pad3(msPart);
  }

  function formatVttTime(ms) {
    const { h, m, s, msPart } = msToParts(ms);
    return pad2(h) + ":" + pad2(m) + ":" + pad2(s) + "." + pad3(msPart);
  }

  function formatSbvTime(ms) {
    const { h, m, s, msPart } = msToParts(ms);
    return String(h) + ":" + pad2(m) + ":" + pad2(s) + "." + pad3(msPart);
  }

  function msToParts(totalMs) {
    let ms = Math.max(0, Math.round(Number(totalMs) || 0));
    const h = Math.floor(ms / 3600000);
    ms -= h * 3600000;
    const m = Math.floor(ms / 60000);
    ms -= m * 60000;
    const s = Math.floor(ms / 1000);
    ms -= s * 1000;
    return { h, m, s, msPart: ms };
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function pad3(n) {
    return String(n).padStart(3, "0");
  }

  function normalizeNewlines(text) {
    return String(text == null ? "" : text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }

  function finalizeLineEndings(text, normalize) {
    if (!normalize) return text;
    let out = normalizeNewlines(text);

    // Reduce excessive blank lines at file end
    out = out.replace(/\n+$/g, "\n");

    return out;
  }
})();