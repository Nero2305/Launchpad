# Contributing

Use Node 22+ and Python 3.12. Follow the README to install dependencies and run both services. Keep sample data fictional and never commit credentials.

For a change, explain the user-visible behavior and any data/schema impact. Add behavior-focused tests for meaningful logic changes, run `npm test`, `npm run build`, and `python -m pytest -q` in your virtual environment. Format frontend changes with `npm run format`.

Database changes should use a new numbered SQL migration rather than silently editing a schema already installed by users. Verify ownership policies using two test accounts. Keep the README and verification record honest about what has been exercised locally versus on a live deployment.
