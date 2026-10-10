import handleResponse from "../utils/helper.js";
import {
  evaluateReferral,
  getCustomerReferralOverview,
  getPublicReferralProgram,
  getReferralConfig,
  getReferralDetail,
  listAuditLogs,
  listReferrals,
  updateReferralConfig,
  validateCodeForSignup,
} from "../services/referralService.js";

const customerIdOf = (req) => req.user?.id || req.user?._id || req.user?.userId;

function fail(res, error) {
  return handleResponse(res, error.statusCode || 500, error.message);
}

/* ---------- Customer ---------- */

export const getMyReferral = async (req, res) => {
  try {
    const data = await getCustomerReferralOverview(customerIdOf(req));
    return handleResponse(res, 200, "Referral overview fetched", data);
  } catch (error) {
    return fail(res, error);
  }
};

export const getReferralProgram = async (req, res) => {
  try {
    return handleResponse(res, 200, "Referral program fetched", await getPublicReferralProgram());
  } catch (error) {
    return fail(res, error);
  }
};

export const validateReferralCode = async (req, res) => {
  try {
    const result = await validateCodeForSignup(req.params.code);
    return handleResponse(res, result.valid ? 200 : 400, result.valid ? "Valid referral code" : result.message, result);
  } catch (error) {
    return fail(res, error);
  }
};

/* ---------- Admin ---------- */

export const adminGetReferralSettings = async (req, res) => {
  try {
    return handleResponse(res, 200, "Referral settings fetched", await getReferralConfig());
  } catch (error) {
    return fail(res, error);
  }
};

export const adminUpdateReferralSettings = async (req, res) => {
  try {
    const updated = await updateReferralConfig(req.body || {}, { actorId: customerIdOf(req) });
    return handleResponse(res, 200, "Referral settings updated", updated);
  } catch (error) {
    return fail(res, error);
  }
};

export const adminListReferrals = async (req, res) => {
  try {
    return handleResponse(res, 200, "Referrals fetched", await listReferrals(req.query || {}));
  } catch (error) {
    return fail(res, error);
  }
};

export const adminGetReferral = async (req, res) => {
  try {
    return handleResponse(res, 200, "Referral fetched", await getReferralDetail(req.params.id));
  } catch (error) {
    return fail(res, error);
  }
};

export const adminReevaluateReferral = async (req, res) => {
  try {
    const result = await evaluateReferral(req.params.id, {
      actorType: "ADMIN",
      actorId: customerIdOf(req),
    });
    return handleResponse(
      res,
      200,
      result.credited ? "Reward credited" : `Referral is ${result.status}`,
      result,
    );
  } catch (error) {
    return fail(res, error);
  }
};

export const adminListReferralAudit = async (req, res) => {
  try {
    return handleResponse(res, 200, "Referral audit trail fetched", await listAuditLogs(req.query || {}));
  } catch (error) {
    return fail(res, error);
  }
};
