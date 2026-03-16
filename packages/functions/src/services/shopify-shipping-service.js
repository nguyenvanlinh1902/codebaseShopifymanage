/**
 * Shopify Shipping Service
 * Reads and updates delivery profiles (zones + rates) via Shopify GraphQL API.
 * Requires scopes: read_shipping, write_shipping
 */

const GET_DELIVERY_PROFILES_QUERY = `
  {
    deliveryProfiles(first: 20) {
      edges {
        node {
          id
          name
          profileLocationGroups {
            locationGroup { id }
            locationGroupZones(first: 30) {
              edges {
                node {
                  zone { id name }
                  methodDefinitions(first: 30) {
                    edges {
                      node {
                        id
                        name
                        active
                        methodConditions {
                          id
                          field
                          operator
                          conditionCriteria {
                            ... on MoneyV2 { amount currencyCode }
                            ... on Weight { unit value }
                          }
                        }
                        rateProvider {
                          ... on DeliveryRateDefinition {
                            id
                            price { amount currencyCode }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const UPDATE_DELIVERY_PROFILE_MUTATION = `
  mutation UpdateDeliveryProfile($id: ID!, $profile: DeliveryProfileInput!) {
    deliveryProfileUpdate(id: $id, profile: $profile) {
      profile { id name }
      userErrors { field message }
    }
  }
`;

/**
 * Fetch all delivery profiles with zones and rates, return normalized array.
 * @param {import('./shopifyService.js').ShopifyService} shopifyService
 * @returns {Promise<Array>} normalized profiles
 */
export async function getDeliveryProfiles(shopifyService) {
  try {
    // Pass empty vars object to force Content-Type: application/json (required by newer API versions)
    const result = await shopifyService.shopify.graphql(GET_DELIVERY_PROFILES_QUERY, {});
    const edges = result?.deliveryProfiles?.edges || [];
    return edges.map(({node: profile}) => ({
      profileId: profile.id,
      profileName: profile.name,
      locationGroups: (profile.profileLocationGroups || []).map(plg => ({
        locationGroupId: plg.locationGroup.id,
        zones: (plg.locationGroupZones?.edges || []).map(({node: zoneNode}) => ({
          zoneId: zoneNode.zone.id,
          zoneName: zoneNode.zone.name,
          rates: (zoneNode.methodDefinitions?.edges || []).map(({node: md}) => ({
            methodDefinitionId: md.id,
            name: md.name,
            active: md.active,
            rateDefinitionId: md.rateProvider?.id || null,
            price: md.rateProvider?.price?.amount || null,
            currencyCode: md.rateProvider?.price?.currencyCode || null,
            conditions: (md.methodConditions || []).map(c => ({
              id: c.id,
              field: c.field,
              operator: c.operator,
              criteria: c.conditionCriteria
            }))
          }))
        }))
      }))
    }));
  } catch (err) {
    console.error('[ShippingService] getDeliveryProfiles error:', err.message, err.response?.body || err.extensions || '');
    throw err;
  }
}

/**
 * Update delivery profile rates. Batches zones (max 5 per mutation call).
 * @param {import('./shopifyService.js').ShopifyService} shopifyService
 * @param {Array} updates - grouped by profile+locationGroup
 *   [{ profileId, locationGroupId, zones: [{ zoneId, rates: [{ methodDefinitionId, rateDefinitionId, price, currencyCode }] }] }]
 * @returns {Promise<{success: boolean, errors: Array}>}
 */
export async function updateDeliveryProfileRates(shopifyService, updates) {
  const errors = [];

  // Group updates by profileId (one mutation per profile)
  const byProfile = {};
  for (const update of updates) {
    if (!byProfile[update.profileId]) {
      byProfile[update.profileId] = [];
    }
    byProfile[update.profileId].push(update);
  }

  for (const [profileId, locationGroupUpdates] of Object.entries(byProfile)) {
    // Build locationGroupsToUpdate
    const locationGroupsToUpdate = locationGroupUpdates.map(lgu => {
      // Batch zones in chunks of 5
      const allZones = lgu.zones.map(zone => ({
        id: zone.zoneId,
        methodDefinitionsToUpdate: zone.rates.map(rate => ({
          id: rate.methodDefinitionId,
          rateDefinition: {
            id: rate.rateDefinitionId,
            price: {
              amount: String(rate.price),
              currencyCode: rate.currencyCode || 'USD'
            }
          }
        }))
      }));

      return {id: lgu.locationGroupId, allZones};
    });

    // Batch zones per locationGroup (max 5 zones per call)
    for (const lg of locationGroupsToUpdate) {
      const zoneChunks = chunkArray(lg.allZones, 5);
      for (const zoneChunk of zoneChunks) {
        try {
          const result = await shopifyService.shopify.graphql(UPDATE_DELIVERY_PROFILE_MUTATION, {
            id: profileId,
            profile: {
              locationGroupsToUpdate: [{
                id: lg.id,
                zonesToUpdate: zoneChunk
              }]
            }
          });

          const userErrors = result?.deliveryProfileUpdate?.userErrors || [];
          if (userErrors.length > 0) {
            errors.push(...userErrors.map(e => ({profileId, field: e.field, message: e.message})));
          }
        } catch (err) {
          errors.push({profileId, message: err.message});
        }
      }
    }
  }

  return {success: errors.length === 0, errors};
}

/**
 * Replace rates in matched zones: delete existing rates, create new ones from template.
 * Strategy: match profile+zone by name → delete all existing methodDefinitions → create from template.
 * @param {import('./shopifyService.js').ShopifyService} shopifyService
 * @param {Array} templateProfiles - from template snapshot
 * @param {Array} liveProfiles - from getDeliveryProfiles()
 * @returns {Promise<{success: boolean, errors: Array, replaced: number}>}
 */
export async function replaceDeliveryProfileRates(shopifyService, templateProfiles, liveProfiles) {
  const errors = [];
  let replaced = 0;

  for (const tProfile of templateProfiles) {
    // Match profile by name, fallback single-profile
    let liveProfile = liveProfiles.find(lp => lp.profileName === tProfile.profileName);
    if (!liveProfile && liveProfiles.length === 1 && templateProfiles.length === 1) {
      liveProfile = liveProfiles[0];
    }
    if (!liveProfile) continue;

    for (const tLg of tProfile.locationGroups) {
      for (const liveLg of liveProfile.locationGroups) {
        for (const tZone of tLg.zones) {
          // Match zone by name, fallback single-zone
          let liveZone = liveLg.zones.find(lz => lz.zoneName === tZone.zoneName);
          if (!liveZone && liveLg.zones.length === 1 && tLg.zones.length === 1) {
            liveZone = liveLg.zones[0];
          }
          if (!liveZone) continue;

          // Only replace flat-rate definitions (skip carrier-calculated with no rateDefinitionId)
          const templateRates = (tZone.rates || []).filter(r => r.price != null);
          if (templateRates.length === 0) continue;

          // Collect existing methodDefinition IDs to delete
          const idsToDelete = liveZone.rates.map(r => r.methodDefinitionId);

          // Build new rates to create (with conditions)
          const methodDefinitionsToCreate = templateRates.map(r => {
            const def = {
              name: r.name,
              rateDefinition: {
                price: {
                  amount: parseFloat(r.price),
                  currencyCode: r.currencyCode || 'USD'
                }
              }
            };

            // Restore price/weight conditions (e.g. free shipping when order >= $90.01)
            if (r.conditions?.length) {
              const priceConditions = r.conditions
                .filter(c => c.field === 'TOTAL_PRICE')
                .map(c => ({
                  criteria: {amount: parseFloat(c.criteria.amount), currencyCode: c.criteria.currencyCode},
                  operator: c.operator
                }));
              const weightConditions = r.conditions
                .filter(c => c.field === 'TOTAL_WEIGHT')
                .map(c => ({
                  criteria: {value: parseFloat(c.criteria.value), unit: c.criteria.unit},
                  operator: c.operator
                }));
              if (priceConditions.length) def.priceConditionsToCreate = priceConditions;
              if (weightConditions.length) def.weightConditionsToCreate = weightConditions;
            }

            return def;
          });

          try {
            // Single mutation: delete old + create new in same zone
            const result = await shopifyService.shopify.graphql(UPDATE_DELIVERY_PROFILE_MUTATION, {
              id: liveProfile.profileId,
              profile: {
                methodDefinitionsToDelete: idsToDelete,
                locationGroupsToUpdate: [{
                  id: liveLg.locationGroupId,
                  zonesToUpdate: [{
                    id: liveZone.zoneId,
                    methodDefinitionsToCreate
                  }]
                }]
              }
            });

            const userErrors = result?.deliveryProfileUpdate?.userErrors || [];
            if (userErrors.length > 0) {
              errors.push(...userErrors.map(e => ({
                zone: liveZone.zoneName,
                field: e.field,
                message: e.message
              })));
            } else {
              replaced++;
            }
          } catch (err) {
            errors.push({zone: liveZone.zoneName, message: err.message});
          }
        }
      }
    }
  }

  return {success: errors.length === 0, errors, replaced};
}

/**
 * Match template profiles to live profiles by name, return updates array.
 * Matching strategy: profileName → zoneName → rate name (not by GID).
 * @param {Array} templateProfiles - from template snapshot
 * @param {Array} liveProfiles - from getDeliveryProfiles()
 * @returns {Array} updates for updateDeliveryProfileRates()
 */
export function matchTemplateToLiveProfiles(templateProfiles, liveProfiles) {
  const updates = [];

  for (const tProfile of templateProfiles) {
    // Match by name first, fallback to single-profile match
    let liveProfile = liveProfiles.find(lp => lp.profileName === tProfile.profileName);
    if (!liveProfile && liveProfiles.length === 1 && templateProfiles.length === 1) {
      liveProfile = liveProfiles[0];
    }
    if (!liveProfile) {
      console.log(`[ShippingMatch] No profile match for "${tProfile.profileName}". Live: [${liveProfiles.map(p => p.profileName).join(', ')}]`);
      continue;
    }

    for (const tLg of tProfile.locationGroups) {
      for (const liveLg of liveProfile.locationGroups) {
        const zoneUpdates = [];

        for (const tZone of tLg.zones) {
          // Match by name, fallback single-zone
          let liveZone = liveLg.zones.find(lz => lz.zoneName === tZone.zoneName);
          if (!liveZone && liveLg.zones.length === 1 && tLg.zones.length === 1) {
            liveZone = liveLg.zones[0];
          }
          if (!liveZone) {
            console.log(`[ShippingMatch] No zone match for "${tZone.zoneName}". Live: [${liveLg.zones.map(z => z.zoneName).join(', ')}]`);
            continue;
          }

          const rateUpdates = [];
          for (const tRate of tZone.rates) {
            // Match by name, fallback single-rate
            let liveRate = liveZone.rates.find(lr => lr.name === tRate.name);
            if (!liveRate && liveZone.rates.length === 1 && tZone.rates.length === 1) {
              liveRate = liveZone.rates[0];
            }
            if (!liveRate || !liveRate.rateDefinitionId) {
              console.log(`[ShippingMatch] No rate match for "${tRate.name}". Live: [${liveZone.rates.map(r => r.name).join(', ')}]`);
              continue;
            }

            rateUpdates.push({
              methodDefinitionId: liveRate.methodDefinitionId,
              rateDefinitionId: liveRate.rateDefinitionId,
              price: tRate.price,
              currencyCode: tRate.currencyCode || liveRate.currencyCode || 'USD'
            });
          }

          if (rateUpdates.length > 0) {
            zoneUpdates.push({zoneId: liveZone.zoneId, rates: rateUpdates});
          }
        }

        if (zoneUpdates.length > 0) {
          updates.push({
            profileId: liveProfile.profileId,
            locationGroupId: liveLg.locationGroupId,
            zones: zoneUpdates
          });
        }
      }
    }
  }

  return updates;
}

/** Split array into chunks of given size */
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
