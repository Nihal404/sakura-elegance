import "@tanstack/router-core";

declare module "@tanstack/router-core" {
  interface FilebaseRouteOptionsInterface {
    server?: {
      handlers?: Record<string, any>;
    };
  }
}
