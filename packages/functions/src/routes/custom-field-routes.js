import {Router} from 'express';
import * as fieldCtrl from '../controllers/custom-field-controller.js';
import * as deployCtrl from '../controllers/custom-field-deploy-controller.js';

const router = new Router();

// Field definitions CRUD
router.get('/', fieldCtrl.listFields);
router.post('/', fieldCtrl.createField);
router.put('/:id', fieldCtrl.updateField);
router.delete('/:id', fieldCtrl.deleteField);

// Store setup
router.post('/deploy', deployCtrl.deployToStores);
router.post('/deploy-check', deployCtrl.checkDeployment);

// Collection management per store
router.get('/collections/:storeId', deployCtrl.listStoreCollections);
router.post('/collections/:storeId/toggle', deployCtrl.toggleCollectionCustomFields);

export default router;
