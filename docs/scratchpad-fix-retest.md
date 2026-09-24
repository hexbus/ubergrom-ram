# Scratchpad workspace fix

The library now borrows console scratchpad registers during RAM transfers
and restores them afterward. The caller can keep its workspace in expansion
RAM. See the [call reference](abi.md#grom-and-interrupt-handling) and
[hardware results](hardware-results.md).

The earlier retest delivery is historical. Use the current
[test directions](hardware-test-kit.md).
