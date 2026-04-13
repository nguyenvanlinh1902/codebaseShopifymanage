import {Router} from 'express';
import * as customFieldController from '../controllers/custom-field-controller.js';
import * as customFieldDeployController from '../controllers/custom-field-deploy-controller.js';

const router = new Router();

// CRUD
router.get('/', customFieldController.listFields);
router.post('/', customFieldController.createField);
router.put('/:id', customFieldController.updateField);
router.delete('/:id', customFieldController.deleteField);

// Get Liquid snippet code for manual theme editing
router.get('/snippet', customFieldController.getSnippet);

// Deploy
router.post('/deploy', customFieldDeployController.deployToStores);
router.post('/deploy-check', customFieldDeployController.checkDeployment);
router.post('/undeploy', customFieldDeployController.undeployFromStores);

export default router;
