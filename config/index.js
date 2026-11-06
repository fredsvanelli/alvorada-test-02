// Configuration shared by the workspaces. A value belongs here when the API and
// the web app must agree on it, so neither keeps its own copy. Plain JavaScript,
// because Node does not strip types from a package under node_modules, and the web
// unit tests run with `node --test`.

// The bookable window is [0, 100): an end can be 100, and start < end keeps a
// start below it.
export const MAX_TIME = 100;
