# Codebase Memory Rules

## IMPORTANT

Before reading source code, ALWAYS use Codebase Memory.

Priority:

1. get_architecture
2. search_graph
3. trace_path
4. query_graph
5. get_code_snippet

Only if the information is missing:

- Read individual files.
- Never scan the entire repository.
- Never recursively read directories.

When modifying code:

- Determine impacted files using trace_path.
- Read only those files.
- Modify the minimum possible amount of code.

When answering architecture questions:

Never inspect the repository manually.
Always answer using Codebase Memory.

When searching code:

Prefer search_graph over grep.
Prefer query_graph over file searches.