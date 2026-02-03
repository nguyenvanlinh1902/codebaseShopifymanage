import React from 'react';
import {Route, Redirect} from 'react-router-dom';
import PropTypes from 'prop-types';
import {Spinner} from '@shopify/polaris';
import {useAuth} from '@assets/contexts/authContext';
import {isEmbeddedApp} from '@assets/config/app';

/**
 * A route that is only accessible to non-authenticated users
 * Redirects to dashboard if user is already authenticated
 */
export default function GuestRoute({component: Component, ...rest}) {
  const {isAuthenticated, loading} = useAuth();

  // In embedded mode, these routes shouldn't be used
  if (isEmbeddedApp) {
    return <Redirect to="/" />;
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

        if (isAuthenticated) {
          // Redirect to the page they were trying to access, or default to tickets
          const from = props.location?.state?.from?.pathname || '/tickets';
          return <Redirect to={from} />;
        }

        return <Component {...props} />;
      }}
    />
  );
}

GuestRoute.propTypes = {
  component: PropTypes.elementType.isRequired,
  location: PropTypes.object
};
