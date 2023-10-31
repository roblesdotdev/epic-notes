-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "access" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_PermissionToRole" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_PermissionToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "Permission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_PermissionToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_RoleToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_action_entity_access_key" ON "Permission"("action", "entity", "access");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_PermissionToRole_AB_unique" ON "_PermissionToRole"("A", "B");

-- CreateIndex
CREATE INDEX "_PermissionToRole_B_index" ON "_PermissionToRole"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_RoleToUser_AB_unique" ON "_RoleToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_RoleToUser_B_index" ON "_RoleToUser"("B");

-- Manual roles seed
INSERT INTO Permission VALUES('cloe76z0i0000jm52zlv77mcu','create','user','own','',1698748831170,1698748831170);
INSERT INTO Permission VALUES('cloe76z5i0001jm521m3ftb7q','create','user','any','',1698748831350,1698748831350);
INSERT INTO Permission VALUES('cloe76z8w0002jm52kuxa6svl','read','user','own','',1698748831473,1698748831473);
INSERT INTO Permission VALUES('cloe76zcm0003jm52qrdakihv','read','user','any','',1698748831607,1698748831607);
INSERT INTO Permission VALUES('cloe76zg30004jm52cy1oroq4','update','user','own','',1698748831731,1698748831731);
INSERT INTO Permission VALUES('cloe76zjr0005jm52oy8dl0le','update','user','any','',1698748831863,1698748831863);
INSERT INTO Permission VALUES('cloe76znq0006jm52l57gh9t8','delete','user','own','',1698748832007,1698748832007);
INSERT INTO Permission VALUES('cloe76zrf0007jm52wivo3eia','delete','user','any','',1698748832139,1698748832139);
INSERT INTO Permission VALUES('cloe76zv50008jm52aiyitv5x','create','note','own','',1698748832273,1698748832273);
INSERT INTO Permission VALUES('cloe76zz90009jm52vm6a4puo','create','note','any','',1698748832422,1698748832422);
INSERT INTO Permission VALUES('cloe7702y000ajm52jofoutjn','read','note','own','',1698748832555,1698748832555);
INSERT INTO Permission VALUES('cloe7706e000bjm525utazibc','read','note','any','',1698748832679,1698748832679);
INSERT INTO Permission VALUES('cloe770a4000cjm52ih7jjxfv','update','note','own','',1698748832812,1698748832812);
INSERT INTO Permission VALUES('cloe770dl000djm52za5r8mil','update','note','any','',1698748832937,1698748832937);
INSERT INTO Permission VALUES('cloe770hh000ejm52nh7osvzo','delete','note','own','',1698748833078,1698748833078);
INSERT INTO Permission VALUES('cloe770ki000fjm52wpokixuq','delete','note','any','',1698748833186,1698748833186);

INSERT INTO Role VALUES('cloe770nm000gjm52kjszvubw','admin','',1698748833298,1698748833298);
INSERT INTO Role VALUES('cloe770rp000hjm525stdhmbv','user','',1698748833445,1698748833445);

INSERT INTO _PermissionToRole VALUES('cloe76z5i0001jm521m3ftb7q','cloe770nm000gjm52kjszvubw');
INSERT INTO _PermissionToRole VALUES('cloe76zcm0003jm52qrdakihv','cloe770nm000gjm52kjszvubw');
INSERT INTO _PermissionToRole VALUES('cloe76zjr0005jm52oy8dl0le','cloe770nm000gjm52kjszvubw');
INSERT INTO _PermissionToRole VALUES('cloe76zrf0007jm52wivo3eia','cloe770nm000gjm52kjszvubw');
INSERT INTO _PermissionToRole VALUES('cloe76zz90009jm52vm6a4puo','cloe770nm000gjm52kjszvubw');
INSERT INTO _PermissionToRole VALUES('cloe7706e000bjm525utazibc','cloe770nm000gjm52kjszvubw');
INSERT INTO _PermissionToRole VALUES('cloe770dl000djm52za5r8mil','cloe770nm000gjm52kjszvubw');
INSERT INTO _PermissionToRole VALUES('cloe770ki000fjm52wpokixuq','cloe770nm000gjm52kjszvubw');
INSERT INTO _PermissionToRole VALUES('cloe76z0i0000jm52zlv77mcu','cloe770rp000hjm525stdhmbv');
INSERT INTO _PermissionToRole VALUES('cloe76z8w0002jm52kuxa6svl','cloe770rp000hjm525stdhmbv');
INSERT INTO _PermissionToRole VALUES('cloe76zg30004jm52cy1oroq4','cloe770rp000hjm525stdhmbv');
INSERT INTO _PermissionToRole VALUES('cloe76znq0006jm52l57gh9t8','cloe770rp000hjm525stdhmbv');
INSERT INTO _PermissionToRole VALUES('cloe76zv50008jm52aiyitv5x','cloe770rp000hjm525stdhmbv');
INSERT INTO _PermissionToRole VALUES('cloe7702y000ajm52jofoutjn','cloe770rp000hjm525stdhmbv');
INSERT INTO _PermissionToRole VALUES('cloe770a4000cjm52ih7jjxfv','cloe770rp000hjm525stdhmbv');
INSERT INTO _PermissionToRole VALUES('cloe770hh000ejm52nh7osvzo','cloe770rp000hjm525stdhmbv');
