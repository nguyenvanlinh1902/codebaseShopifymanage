# API Hooks

## Fetch Data

```javascript
const {data, loading, fetchApi} = useFetchApi({
  url: '/api/customers',
  defaultData: [],
  initLoad: true  // Load on mount
});
```

## Create/Update

```javascript
const {creating, handleCreate} = useCreateApi({
  url: '/api/customers',
  successMsg: 'Customer created successfully',
  successCallback: () => fetchApi()
});

// Usage
await handleCreate({ name, email, points });
```

## Delete

```javascript
const {deleting, handleDelete} = useDeleteApi({
  url: '/api/customers',
  successMsg: 'Customer deleted',
  successCallback: () => fetchApi()
});

// Usage
await handleDelete(customerId);
```

## Edit (Update)

```javascript
const {editing, handleEdit} = useEditApi({
  url: `/api/customers/${customerId}`,
  successMsg: 'Customer updated successfully',
  successCallback: () => fetchApi()
});

// Usage
await handleEdit({ name, email, points });
```

## useFetchApi Options

| Option | Type | Description |
|--------|------|-------------|
| `url` | string | API endpoint |
| `defaultData` | any | Default value while loading |
| `initLoad` | boolean | Load on component mount |
| `params` | object | Query parameters |

## Hook Return Values

### useFetchApi

| Property | Type | Description |
|----------|------|-------------|
| `data` | any | Response data |
| `loading` | boolean | Loading state |
| `fetchApi` | function | Refetch function |
| `setData` | function | Update local data |

### useCreateApi / useEditApi

| Property | Type | Description |
|----------|------|-------------|
| `creating` / `editing` | boolean | Loading state |
| `handleCreate` / `handleEdit` | function | Submit function |

### useDeleteApi

| Property | Type | Description |
|----------|------|-------------|
| `deleting` | boolean | Loading state |
| `handleDelete` | function | Delete function |

## Error Handling

```javascript
const {handleCreate} = useCreateApi({
  url: '/api/customers',
  successMsg: 'Created!',
  errorCallback: (error) => {
    console.error('Failed:', error);
    // Custom error handling
  }
});
```
