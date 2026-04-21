from pathlib import Path
import re

path = Path(r"C:\Users\dongu\atlas\PROGRESS.md")
text = path.read_text(encoding="utf-8")

text = re.sub(r'^\| Frontend \(Prism\) \| .*$', '| Frontend (Prism) | IN_PROGRESS | Phase 20.1 - Run Lighthouse audit on every page | 2026-04-01T22:14:00-05:00 |', text, count=1, flags=re.M)
text = re.sub(r'^## Current Phase: .*$', '## Current Phase: Phase 20 active. Frontend remains on the canonical Phase 20.1 checkpoint, and the current frontend checkpoint is still open on Run Lighthouse audit on every page. Polish is COMPLETE.', text, count=1, flags=re.M)
text = re.sub(r'^## Agents Running: .*$', '## Agents Running: Frontend (Prism)', text, count=1, flags=re.M)
text = re.sub(r'^## Last Updated: .*$', '## Last Updated: 2026-04-02T03:14:00Z', text, count=1, flags=re.M)
marker = '## Log\n'
idx = text.index(marker) + len(marker)
existing = [line for line in text[idx:].splitlines() if line.startswith('- [')]
new_line = '- [2026-04-02T03:14:00Z] Re-read HEARTBEAT.md, memory/LESSONS.md, memory/COMPLETED-TASKS.md, and all canonical progress files; frontend/PROGRESS.md remains canonically on Phase 20.1, no live Prism worker remained after the worker checks, so I relaunched Frontend on the canonical Lighthouse-audit checkpoint, refreshed the lead dashboard timestamp, and kept the heartbeat log capped at 10 entries.'
filtered = [line for line in existing if not line.startswith('- [2026-04-02T03:14:00Z]')]
text = text[:idx] + '\n'.join([new_line] + filtered[:9]) + '\n'
path.write_text(text, encoding="utf-8")
