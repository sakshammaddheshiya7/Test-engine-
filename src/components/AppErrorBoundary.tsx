import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info);
    void import("../services/systemOpsService")
      .then(({ logClientError }) =>
        logClientError({
          source: "render_boundary",
          message: error.message,
          stack: `${error.stack ?? ""}\n${info.componentStack ?? ""}`,
          route: window.location.pathname,
        }),
      )
      .catch(() => undefined);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="glass-panel mx-auto mt-16 max-w-md rounded-[24px] p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">Debug Guard</p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Something went wrong</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Reload the app. If the issue continues, check Firebase rules/config and recent admin data updates.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2 text-xs font-semibold text-white"
          >
            Reload App
          </button>
        </section>
      );
    }

    return this.props.children;
  }
}
