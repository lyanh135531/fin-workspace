# Services layer

Financial calculations, wallet balance updates, and Prisma transactions belong only in this directory.

Server Actions must validate input, resolve the authenticated actor, enforce RBAC, then delegate to a service. UI components must never mutate financial records directly.
