---
name: Streamlit startup
description: Environment-specific startup behavior for the Streamlit app.
---

The Streamlit workflow should invoke the project-installed executable with headless mode enabled:

`.pythonlibs/bin/streamlit run main.py --server.port 5000 --server.address 0.0.0.0 --server.headless true`

**Why:** The generic `streamlit` workflow command paused for Streamlit's interactive first-run email prompt and never opened the preview port, while the project executable with headless mode starts cleanly.

**How to apply:** Preserve this command when restarting or reconfiguring the app workflow.