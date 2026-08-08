---
name: Streamlit startup
description: Environment-specific startup behavior for the Streamlit app.
---

The Streamlit workflow should invoke the project-installed executable with headless mode enabled:

`.pythonlibs/bin/streamlit run main.py --server.port 5000 --server.address 0.0.0.0 --server.headless true`

**Why:** The generic `streamlit` workflow command paused for Streamlit's interactive first-run email prompt and never opened the preview port, while the project executable with headless mode starts cleanly.

**How to apply:** Preserve this command when restarting or reconfiguring the app workflow.

The workflow supervisor can occasionally report a failed restart immediately after Streamlit logs that it has bound port 5000, even when the same command runs correctly in a direct process. Verify the actual port and HTTP response before changing application code.

**Why:** The uploaded app compiled and started cleanly in a direct probe while the supervisor returned a timeout with no Python traceback.

**How to apply:** Treat a supervisor timeout without an application traceback as a workflow/process-state issue first; inspect the port and logs before editing the app.