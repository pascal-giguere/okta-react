/*
 * Copyright (c) 2017-Present, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and limitations under the License.
 */

import * as React from 'react';
import { useOktaAuth, OnAuthRequiredFunction } from './OktaContext';
import { RouteProps } from 'react-router';
import * as ReactRouterDom from 'react-router-dom';
import { toRelativeUrl, AuthSdkError } from '@okta/okta-auth-js';
import OktaError from './OktaError';

/***
 * Workaround to support react-router v6
 * Issue: https://github.com/okta/okta-react/issues/178
 * Open PR: https://github.com/okta/okta-react/pull/26
 * Fix by flying-sheep: https://github.com/okta/okta-react/compare/master...flying-sheep:flying-sheep/okta-react-router-6
 * **/
// react-router v6 exports useMatch, react-router v5 exports useRouteMatch
const useMatch = Object.entries(ReactRouterDom).filter(([k, _v]) => k == 'useMatch' || k == 'useRouteMatch')[0][1];

const SecureRoute: React.FC<{
  onAuthRequired?: OnAuthRequiredFunction;
  errorComponent?: React.ComponentType<{ error: Error }>;
} & ReactRouterDom.RouteProps & React.HTMLAttributes<HTMLDivElement>> = ({ 
  onAuthRequired,
  errorComponent,
  ...routeProps
}) => { 
  const { oktaAuth, authState, _onAuthRequired } = useOktaAuth();
  const { path, caseSensitive } = routeProps;
  const match = path ? useMatch.call(null, { path, caseSensitive }) : null;
  const pendingLogin = React.useRef(false);
  const [handleLoginError, setHandleLoginError] = React.useState<Error | null>(null);
  const ErrorReporter = errorComponent || OktaError;

  React.useEffect(() => {
    const handleLogin = async () => {
      if (pendingLogin.current) {
        return;
      }

      pendingLogin.current = true;

      const originalUri = toRelativeUrl(window.location.href, window.location.origin);
      oktaAuth.setOriginalUri(originalUri);
      const onAuthRequiredFn = onAuthRequired || _onAuthRequired;
      if (onAuthRequiredFn) {
        await onAuthRequiredFn(oktaAuth);
      } else {
        await oktaAuth.signInWithRedirect();
      }
    };

    // Only process logic if the route matches
    if (!match) {
      return;
    }

    if (!authState) {
      return;
    }

    if (authState.isAuthenticated) {
      pendingLogin.current = false;
      return;
    }

    // Start login if app has decided it is not logged in and there is no pending signin
    if(!authState.isAuthenticated) { 
      handleLogin().catch(err => {
        setHandleLoginError(err as Error);
      });
    }  

  }, [
    authState,
    oktaAuth, 
    match, 
    onAuthRequired, 
    _onAuthRequired
  ]);

  if (handleLoginError) {
    return <ErrorReporter error={handleLoginError} />;
  }

  if (!authState || !authState.isAuthenticated) {
    return null;
  }

  return (
    <ReactRouterDom.Route
      { ...routeProps }
    />
  );
};

export default SecureRoute;
