import type { Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { users, notifications } from "../../shared/schema";
import { env, stripeEnabled, mailEnabled } from "../env";
import { syncCustomer } from "../stripe";
import { sendMail } from "../mail";

export async function renewalJob(req: Request,res: Response) {
 const secret=process.env.CRON_SECRET;
 const actual=Buffer.from(req.headers.authorization??"");
 const expected=Buffer.from("Bearer "+(secret??""));
 if(!secret||secret.length<32||actual.length!==expected.length||!timingSafeEqual(actual,expected)) return res.sendStatus(401);
 res.setHeader("Cache-Control","no-store");
 const candidates=await db.select().from(users).where(and(sql`${users.role} <> 'admin'`,sql`${users.stripeSubscriptionId} is not null`,sql`${users.currentPeriodEnd} <= now() + interval '7 days'`,sql`${users.subscriptionStatus} in ('active','trialing','past_due')`)).limit(20);
 let notices=0,errors=0,synced=0;
 const deadline=Date.now()+40000;
 for(const candidate of candidates){
   if(Date.now()>deadline)break;
   try{
     if(!stripeEnabled())continue;
     await syncCustomer(candidate);synced++;
     const [u]=await db.select().from(users).where(eq(users.id,candidate.id));
     if(!u?.currentPeriodEnd||!["active","trialing","past_due"].includes(u.subscriptionStatus??""))continue;
     const days=Math.ceil((u.currentPeriodEnd.getTime()-Date.now())/86400000);
     if(![7,3,1].includes(days))continue;
     const key=u.stripeSubscriptionId+":"+u.currentPeriodEnd.toISOString()+":"+days;
     const title="Tu suscripción ComicKlu vence en "+days+" día(s)";
     const body=(u.cancelAtPeriodEnd?"Tu plan termina pronto. Puedes renovarlo desde tu cuenta.":"Revisa tu método de pago para mantener tu plan activo.")+" "+env.appUrl+"/account";
     const created=await db.transaction(async tx=>{
       await tx.select({id:users.id}).from(users).where(eq(users.id,u.id)).for("update");
       const [prior]=await tx.select({id:notifications.id}).from(notifications).where(and(eq(notifications.userId,u.id),sql`${notifications.data}->>'renewalKey' = ${key}`)).limit(1);
       if(prior)return false;
       await tx.insert(notifications).values({userId:u.id,type:"system",title,body,data:{renewalKey:key}});
       return true;
     });
     if(created){notices++;if(mailEnabled())await sendMail(u.email,title,body);}
   }catch(e){errors++;console.error("[renewals] processing failed",e instanceof Error?e.name:"unknown");}
 }
 return res.status(errors?503:200).json({synced,notices,errors,mailConfigured:mailEnabled(),stripeConfigured:stripeEnabled()});
}
