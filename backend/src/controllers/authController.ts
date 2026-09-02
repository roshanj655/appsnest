import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middleware/auth';
import User, { IUser } from '../models/master/User';
import Business, { IBusiness } from '../models/master/Business';
import { getTenantConnection } from '../utils/tenantConnection';
import { initializeTenantDatabase } from '../services/tenantInitializer';
import { resolvePermissions } from '../constants/permissions';
import { getBusinessAccessError } from '../utils/businessAccess';

const generateAccessToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET as string, { expiresIn: '1d' });
};

const generateRefreshToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '30d' });
};

const generateTenantId = (): string => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 900000 + 100000).toString();
  return `${timestamp}${random}`;
};

const buildAuthResponse = (user: IUser, business: IBusiness | null, accessToken: string, refreshToken: string) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  permissions: resolvePermissions(user),
  customPermissions: user.permissions || [],
  deniedPermissions: user.deniedPermissions || [],
  business,
  accessToken,
  refreshToken
});

const generateAtlasConnectionString = (dbName: string): string => {
  const masterUri = process.env.MASTER_DATABASE_URI;
  if (!masterUri) throw new Error('MASTER_DATABASE_URI not set');
  const url = new URL(masterUri);
  url.pathname = `/${dbName}`;
  return url.toString();
};

export const registerBusiness = async (req: Request, res: Response) => {
  try {
    const {
      businessName,
      ownerName,
      businessEmail,
      businessPhone,
      userName,
      userEmail,
      userPassword,
      userPhone,
      databaseProvider,
      atlasProjectName,
      clusterName,
      databaseName,
      connectionString,
      subscriptionPlan,
      subscriptionStartsAt,
      subscriptionEndsAt
    } = req.body;

    const tenantId = generateTenantId();
    const finalDatabaseName = databaseName || `tenant_${tenantId}`;
    
    let finalConnectionString = connectionString;
    if (databaseProvider === 'atlas' && !connectionString) {
      finalConnectionString = generateAtlasConnectionString(finalDatabaseName);
    }

    const businessData = {
      tenantId,
      businessName,
      ownerName,
      email: businessEmail,
      phone: businessPhone,
      databaseProvider: databaseProvider || 'atlas',
      atlasProjectName,
      clusterName,
      databaseName: finalDatabaseName,
      connectionString: finalConnectionString,
      subscriptionPlan: subscriptionPlan || 'basic',
      subscriptionStartsAt: subscriptionStartsAt || undefined,
      subscriptionEndsAt: subscriptionEndsAt || undefined,
      status: 'active' as const
    };
    const business = await Business.create(businessData as unknown as any);

    const userData = {
      name: userName,
      email: userEmail,
      password: userPassword,
      phone: userPhone,
      businessId: business._id,
      role: 'admin' as const
    };
    const user = await User.create(userData as unknown as any);

    const tenantConnection = await getTenantConnection(business);
    await initializeTenantDatabase(tenantConnection, business);

    res.status(201).json({
      message: 'Business registered',
      business,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Error registering business' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const userResult = await User.findOne({ email }).select('+password').populate('businessId');
    const user = userResult as unknown as (IUser & { businessId?: IBusiness }) | null;

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const business = user.role === 'superadmin' ? null : (user.businessId as IBusiness);
    if (user.role !== 'superadmin') {
      const accessError = getBusinessAccessError(business);
      if (accessError) {
        return res.status(403).json({ message: accessError });
      }
    }

    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    user.refreshToken = refreshToken;
    await user.save();

    res.json(buildAuthResponse(user, business || null, accessToken, refreshToken));

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    const decoded: any = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string);
    const user = await User.findById(decoded.id) as unknown as (IUser | null);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const accessToken = generateAccessToken(user._id.toString());

    res.json({ accessToken });
  } catch (error) {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }
    const user = await User.findById(req.user?._id).select('+password');
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating password' });
  }
};
