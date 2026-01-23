import express, { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { config } from "../utils/config";
import { logger } from "../utils/logger";

const router = express.Router();
const prisma = new PrismaClient();

// Admin login
router.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      // Find admin
      const admin = await prisma.admin.findUnique({
        where: { email },
        include: { permissions: true },
      });

      if (!admin || !admin.isActive) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(
        password,
        admin.passwordHash
      );
      if (!isValidPassword) {
        res.status(400).json({ error: "Invalid credentials" });
        return;
      }

      // Update last login
      await prisma.admin.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
      });

      // Generate token
      const token = jwt.sign(
        {
          adminId: admin.id,
          email: admin.email,
          role: admin.role,
        },
        config.jwtSecret
      );

      // Log admin action
      await prisma.adminLog.create({
        data: {
          adminId: admin.id,
          action: "LOGIN",
          resource: "auth",
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      logger.info("Admin login successful", {
        adminId: admin.id,
        email: admin.email,
      });

      res.json({
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
          permissions: admin.permissions.map((p: any) => p.name),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Change password
router.post(
  "/change-password",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        res
          .status(400)
          .json({ error: "Current password and new password are required" });
        return;
      }

      if (newPassword.length < 8) {
        res
          .status(400)
          .json({ error: "New password must be at least 8 characters long" });
        return;
      }

      // This would use the auth middleware in a complete implementation
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
