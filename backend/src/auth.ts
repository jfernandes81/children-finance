import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "children-finance-dev-secret";

export type JwtUser = {
  id: number;
  username: string;
  role: "child" | "parent";
  displayName: string;
};

export type AuthedRequest = Request & { user?: JwtUser };

export function signToken(user: JwtUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "30d" });
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as JwtUser;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Sessão inválida" });
  }
}

export function requireParent(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "parent") {
    return res.status(403).json({ error: "Acesso só para pais" });
  }
  next();
}
