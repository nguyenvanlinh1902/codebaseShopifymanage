import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION = 'shipping_templates';
const JOBS_COLLECTION = 'shipping_apply_jobs';

/**
 * Shipping Template Repository
 * Manages shipping rate templates and bulk-apply jobs in Firestore
 */
export class ShippingTemplateRepository {
  constructor() {
    this._db = null;
  }

  get db() {
    if (!this._db) this._db = getFirestore();
    return this._db;
  }

  get collection() {
    return this.db.collection(COLLECTION);
  }

  get jobsCollection() {
    return this.db.collection(JOBS_COLLECTION);
  }

  // ============ TEMPLATES ============

  /** Create template from store's live shipping data */
  async createTemplate({name, description, sourceStore, profiles}) {
    const docRef = this.collection.doc();
    const now = new Date().toISOString();
    const record = {
      id: docRef.id,
      name,
      description: description || '',
      sourceStore,
      profiles,
      createdAt: now,
      updatedAt: now
    };
    await docRef.set(record);
    return record;
  }

  /** List all templates (without profiles field for smaller response) */
  async listTemplates() {
    const snapshot = await this.collection.orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(d => {
      const data = d.data();
      // Exclude profiles from list response
      const {profiles, ...meta} = data;
      // Include zone/rate summary counts
      let zoneCount = 0;
      let rateCount = 0;
      (profiles || []).forEach(p => {
        (p.locationGroups || []).forEach(lg => {
          zoneCount += (lg.zones || []).length;
          (lg.zones || []).forEach(z => {
            rateCount += (z.rates || []).length;
          });
        });
      });
      return {...meta, zoneCount, rateCount};
    });
  }

  /** Get single template with full profiles */
  async getTemplate(templateId) {
    const doc = await this.collection.doc(templateId).get();
    return doc.exists ? doc.data() : null;
  }

  /** Delete template */
  async deleteTemplate(templateId) {
    await this.collection.doc(templateId).delete();
  }

  /** Update template name/description only */
  async updateTemplateMeta(templateId, {name, description}) {
    const updates = {updatedAt: new Date().toISOString()};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    await this.collection.doc(templateId).update(updates);
    return updates;
  }

  /** Update template profiles (re-capture from store) */
  async updateTemplateProfiles(templateId, {sourceStore, profiles}) {
    const updates = {
      sourceStore,
      profiles,
      updatedAt: new Date().toISOString()
    };
    await this.collection.doc(templateId).update(updates);
    return updates;
  }

  // ============ JOBS ============

  /** Create a bulk apply job */
  async createJob({templateId, templateName, shopDomains}) {
    const docRef = this.jobsCollection.doc();
    const now = new Date().toISOString();
    const record = {
      id: docRef.id,
      templateId,
      templateName: templateName || '',
      status: 'running',
      initiatedAt: now,
      completedAt: null,
      stores: shopDomains.map(domain => ({
        shopDomain: domain,
        status: 'pending',
        error: null,
        appliedAt: null
      }))
    };
    await docRef.set(record);
    return record;
  }

  /** Get job by ID */
  async getJob(jobId) {
    const doc = await this.jobsCollection.doc(jobId).get();
    return doc.exists ? doc.data() : null;
  }

  /** Update job with per-store results */
  async updateJob(jobId, {status, stores, completedAt}) {
    const updates = {};
    if (status) updates.status = status;
    if (stores) updates.stores = stores;
    if (completedAt) updates.completedAt = completedAt;
    await this.jobsCollection.doc(jobId).update(updates);
  }
}
