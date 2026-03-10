/** Shared time period options for Campaign Ads panels */
export const TIME_OPTIONS = [
  {label: 'This month', value: 'this_month'},
  {label: 'Last 7 days', value: 'last_7'},
  {label: 'Last 30 days', value: 'last_30'},
  {label: 'Last month', value: 'last_month'},
  {label: 'This year', value: 'this_year'}
];

export const TIME_PARAMS = {
  this_month: {since: 'startOfMonth(0m)', until: 'today'},
  last_7: {since: '-7d', until: 'today'},
  last_30: {since: '-30d', until: 'today'},
  last_month: {since: 'startOfMonth(-1m)', until: 'endOfMonth(-1m)'},
  this_year: {since: 'startOfYear(0y)', until: 'today'}
};
