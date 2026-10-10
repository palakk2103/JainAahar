import axiosInstance from '@core/api/axios';

/**
 * Refer & Earn admin endpoints (settings, logs, audit trail).
 */
export const adminReferralApi = {
    getReferralSettings: () => axiosInstance.get('/admin/referrals/settings'),
    updateReferralSettings: (data) => axiosInstance.put('/admin/referrals/settings', data),
    getReferrals: (params) => axiosInstance.get('/admin/referrals', { params }),
    getReferralDetail: (id) => axiosInstance.get(`/admin/referrals/${id}`),
    reevaluateReferral: (id) => axiosInstance.post(`/admin/referrals/${id}/reevaluate`),
    getReferralAudit: (params) => axiosInstance.get('/admin/referrals/audit', { params }),
};

export default adminReferralApi;
