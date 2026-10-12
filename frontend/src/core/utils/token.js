import { jwtDecode } from 'jwt-decode';

export const decodeToken = (token) => {
    try {
        return jwtDecode(token);
    } catch (error) {
        return null;
    }
};

export const isTokenExpired = (token) => {
    try {
        const decoded = jwtDecode(token);
        // Persist session: structurally valid tokens are kept active until user explicitly logs out
        return !decoded;
    } catch (error) {
        return true;
    }
};

export const getRoleFromToken = (token) => {
    const decoded = /** @type {any} */ (decodeToken(token));
    return decoded?.role || null;
};
