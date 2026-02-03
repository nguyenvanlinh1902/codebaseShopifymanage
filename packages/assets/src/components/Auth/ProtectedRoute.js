import React from 'react';
import {Route, Redirect} from 'react-router-dom';
import PropTypes from 'prop-types';
import {Spinner} from '@shopify/polaris';
import {useAuth} from '@assets/contexts/authContext';
import {isEmbeddedApp} from '@assets/config/app';

/**
 * A route that requires authentication
 * Redirects to login if user is not authenticated (standalone mode only)
 */
export default function ProtectedRoute({component: Component, requiredRoles, ...rest}) {
  const {isAuthenticated, loading, user} = useAuth();

  // In embedded mode, auth is handled by Shopify
  if (isEmbeddedApp) {
    return <Route {...rest} render={props => <Component {...props} />} />;
  }

  return (
    <Route
      {...rest}
      render={props => {
        if (loading) {
          return (
            <div style={{padding: '100px', textAlign: 'center'}}>
              <Spinner size="large" />
            </div>
          );
        }

        if (!isAuthenticated) {
          return (
            <Redirect
              to={{
                pathname: '/login',
                state: {from: props.location}
              }}
            />
          );
        }

        // Check required roles if specified
        if (requiredRoles && requiredRoles.length > 0) {
          if (!user || !requiredRoles.includes(user.role)) {
            return (
              <Redirect
                to={{
                  pathname: '/unauthorized',
                  state: {from: props.location}
                }}
              />
            );
          }
        }

        return <Component {...props} />;
      }}
    />
  );
}

ProtectedRoute.propTypes = {
  component: PropTypes.elementType.isRequired,
  requiredRoles: PropTypes.arrayOf(PropTypes.string),
  location: PropTypes.object
};

ProtectedRoute.defaultProps = {
  requiredRoles: null
};
