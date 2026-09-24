# Original RAM readback probe

This is the probe used to investigate the original failure, with the v0.2.1 library.
Use current [RAMTEST](hardware-test-kit.md) to check the fixed library.
The [hardware results](hardware-results.md) explain what changed.

To rebuild the historical probe, run `tools/build-ramprobe.py` with
`--kit` pointing to the original September 23 kit, `--dsr-repo` pointing
to the DSR checkout, and a fresh `--out` under its `output/` directory.
Check it with `node tests/ramprobe.cjs OUTPUT DSR_REPO`.
