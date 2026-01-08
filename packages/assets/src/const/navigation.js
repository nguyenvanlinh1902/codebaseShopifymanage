export const navigationLinks = [
  {
    label: 'Samples',
    destination: '/samples'
  },
  {
    label: 'Settings',
    destination: '/settings'
  },
  {
    label: 'Tables',
    destination: '/tables'
  },
  {
    label: 'Optional Scopes',
    destination: '/optional-scopes'
  }
].map(item => ({
  ...item,
  destination: '/embed' + item.destination
}));
