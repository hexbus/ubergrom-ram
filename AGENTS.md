# Repository instructions

- Keep this library separate from Adventure's frozen runtime and the reusable DSR.
- Do not include TI ROMs, games, EEPROM dumps, credentials or third-party firmware.
- ABI addresses are virtual. Never claim transparent CPU RAM emulation.
- Preserve physical RAM ownership and test both backends after code changes.
- Label behavioral-model evidence and hardware evidence separately.
- README.md and docs/ own user documentation; link instead of duplicating facts.
- Write in hexbus's plain, practical voice. Keep directions and examples concise.
- Keep development diaries, delivery history and detailed test logs out of the
  main guides. Link to tests/results/ when that evidence is useful.
- After changing user-facing Markdown, regenerate its PDF with
  `powershell -ExecutionPolicy Bypass -File tools/build-docs.ps1 -Path docs/example.md`.
- Code is Apache 2.0; original documentation is CC BY 4.0. Retain attribution.
