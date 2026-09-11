import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onError: () => void;
}
interface State {
  hasError: boolean;
}

/**
 * INIMIGOS 3D — mandatory fallback. If the 3D overlay throws for any
 * reason (a model failing to build, a WebGL context error after mount,
 * etc.), this swallows it and tells the parent to stop trying. The 2D
 * enemy sprites underneath were never removed by mounting this overlay in
 * the first place, so the game keeps rendering enemies with zero gap.
 */
export class Enemy3DErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}
