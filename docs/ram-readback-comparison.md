# Original workspace comparison

The four-method probe compares expansion registers, scratchpad registers,
added pauses and repeated address setup. It deliberately uses the original
v0.2.1 library; today's automatic workspace switch would hide the difference.
See [hardware results](hardware-results.md) for the outcome.

Use the [readback probe build](ram-readback-probe.md) with `--version 2`, then
run `node tests/ramprobe2.cjs OUTPUT DSR_REPO`.
