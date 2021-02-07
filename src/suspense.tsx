import React from 'react';

type Props = {
  fallback: NonNullable<React.ReactNode> | null;
  children: React.ReactNode;
};

type State = {
  suspending: boolean;
};

export class Suspense extends React.Component<Props, State> {
  state = {suspending: false, error: null};
  static getDerivedStateFromError(error: any) {
    if (error instanceof Promise) {
      return {suspending: true};
    } else {
      throw error;
    }
  }

  componentDidCatch(error: any) {
    if (error instanceof Promise) {
      error.then(() => {
        this.setState({suspending: false});
      });
    }
  }

  render() {
    if (this.state.suspending) {
      return this.props.fallback;
    }
    return (
      <React.Suspense fallback={this.props.fallback}>
        {this.props.children}
      </React.Suspense>
    );
  }
}
