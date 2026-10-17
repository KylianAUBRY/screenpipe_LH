# 05: Chat searches the nodes this n8n really has

**What to build:** Before using a node, the chat searches the nodes this n8n has and reads a node's card: description, parameters with allowed values, display conditions and nested required fields, the credential it needs and whether n8n holds none, one (named) or several, and a minimal valid node skeleton. Switched-off nodes (Execute Command, Local File Trigger) show up flagged « switched off here », never usable. Lookup and the Flow check come from one generated catalog.

Spec: `.scratch/hackathon/issues/27-flows-round-two.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The catalog generator writes a browsing layer (index and per-type detail for the latest version) from the same n8n image as the check layer; its size is measured and kept reasonable (compressed or loaded from disk if needed).
- [ ] A search route returns at most about 20 index entries; a card route returns one node's detail plus live credential state from n8n.
- [ ] Switched-off types appear in search, flagged.
- [ ] The skill tells the chat to search and read the card before using a node and to build only from what they return.
- [ ] A test fails when the ScreenPipe n8n nodes differ from the catalog; the pinned-image test still passes.
- [ ] Engine integration tests cover search, card, switched-off flagging and the three credential states.
