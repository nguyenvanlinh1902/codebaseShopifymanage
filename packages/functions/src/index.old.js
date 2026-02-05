import {onRequest} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import {initializeApp} from 'firebase-admin/app';

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

/**
 * TodoList API
 * GET /api/todos - Get all todos
 * POST /api/todos - Create new todo
 * PUT /api/todos/:id - Update todo
 * DELETE /api/todos/:id - Delete todo
 */
export const api = onRequest(
  {
    memory: '512MiB',
    timeoutSeconds: 60,
    invoker: 'public',
    cors: true
  },
  async (req, res) => {
    try {
      // Enable CORS
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        return res.status(204).send('');
      }

      const {method, url} = req;
      const urlPath = url.split('?')[0];

      // Route: GET /api/todos - Get all todos
      if (method === 'GET' && urlPath === '/api/todos') {
        const todosSnapshot = await db.collection('todos').orderBy('createdAt', 'desc').get();
        const todos = todosSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        return res.json({
          success: true,
          data: todos
        });
      }

      // Route: POST /api/todos - Create new todo
      if (method === 'POST' && urlPath === '/api/todos') {
        const {title, description} = req.body;

        if (!title) {
          return res.status(400).json({
            success: false,
            error: 'Title is required'
          });
        }

        const newTodo = {
          title,
          description: description || '',
          completed: false,
          createdAt: new Date().toISOString()
        };

        const docRef = await db.collection('todos').add(newTodo);

        return res.json({
          success: true,
          message: 'Todo created successfully',
          data: {
            id: docRef.id,
            ...newTodo
          }
        });
      }

      // Route: PUT /api/todos/:id - Update todo
      if (method === 'PUT' && urlPath.startsWith('/api/todos/')) {
        const todoId = urlPath.split('/')[3];
        const {title, description, completed} = req.body;

        const todoRef = db.collection('todos').doc(todoId);
        const todoDoc = await todoRef.get();

        if (!todoDoc.exists) {
          return res.status(404).json({
            success: false,
            error: 'Todo not found'
          });
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (completed !== undefined) updateData.completed = completed;
        updateData.updatedAt = new Date().toISOString();

        await todoRef.update(updateData);

        return res.json({
          success: true,
          message: 'Todo updated successfully',
          data: {
            id: todoId,
            ...todoDoc.data(),
            ...updateData
          }
        });
      }

      // Route: DELETE /api/todos/:id - Delete todo
      if (method === 'DELETE' && urlPath.startsWith('/api/todos/')) {
        const todoId = urlPath.split('/')[3];
        const todoRef = db.collection('todos').doc(todoId);
        const todoDoc = await todoRef.get();

        if (!todoDoc.exists) {
          return res.status(404).json({
            success: false,
            error: 'Todo not found'
          });
        }

        await todoRef.delete();

        return res.json({
          success: true,
          message: 'Todo deleted successfully'
        });
      }

      // Default response
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    } catch (error) {
      console.error('API Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);
