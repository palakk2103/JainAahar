import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@core/context/AuthContext';
import { customerApi } from '../services/customerApi';

/**
 * @typedef {Object} CustomerNotificationContextValue
 * @property {number} unreadCount
 * @property {(count: number | ((prev: number) => number)) => void} setUnreadCount
 * @property {() => Promise<void>} refreshUnreadCount
 */

/** @type {CustomerNotificationContextValue} */
const defaultContextValue = {
    unreadCount: 0,
    setUnreadCount: (_val) => {},
    refreshUnreadCount: async () => {},
};

const CustomerNotificationContext = createContext(defaultContextValue);

export const CustomerNotificationProvider = ({ children }) => {
    const { token, user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    const refreshUnreadCount = useCallback(async () => {
        if (!token) {
            setUnreadCount(0);
            return;
        }
        try {
            const response = await customerApi.getNotifications({ limit: 1 });
            const resData = response.data?.result || response.data?.data || response.data;
            const count = Number(resData?.unreadCount);
            if (Number.isFinite(count)) {
                setUnreadCount(Math.max(0, count));
            } else if (Array.isArray(resData?.items) || Array.isArray(resData?.notifications)) {
                const list = resData.items || resData.notifications;
                const unread = list.filter((n) => !n.isRead).length;
                setUnreadCount(unread);
            } else {
                setUnreadCount(0);
            }
        } catch (error) {
            // Silently fail to 0 unread on error (never show fake/dummy count)
            setUnreadCount(0);
        }
    }, [token]);

    useEffect(() => {
        refreshUnreadCount();

        const handleFocus = () => refreshUnreadCount();
        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, [refreshUnreadCount, user?._id || user?.id]);

    return (
        <CustomerNotificationContext.Provider
            value={{
                unreadCount,
                setUnreadCount,
                refreshUnreadCount,
            }}
        >
            {children}
        </CustomerNotificationContext.Provider>
    );
};

/**
 * @returns {CustomerNotificationContextValue}
 */
export const useCustomerNotification = () => useContext(CustomerNotificationContext);
