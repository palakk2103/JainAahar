import dns from 'node:dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../app/models/customer.js';
import Notification from '../app/models/notification.js';

// Dummy notifications seeding has been disabled to prevent overriding genuine user notifications.
console.log('Seed notifications script is disabled: Dummy notifications have been permanently deprecated.');

