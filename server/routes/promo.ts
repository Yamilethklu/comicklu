import { Router } from "express";
import { requireAuth } from "../auth";
export const promoRouter = Router();
promoRouter.use(requireAuth);
promoRouter.get("/", (_req,res) => { res.json([]); });
promoRouter.post(["/validate","/use"], (_req,res) => { res.status(503).json({message:"Promociones temporalmente no disponibles."}); });
