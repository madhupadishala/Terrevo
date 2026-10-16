import {test,expect} from "@playwright/test";

test("functional QA provider exposes operational fields without login",async({page})=>{
  const writes:string[]=[];const consoleErrors:string[]=[];
  page.on("console",msg=>{if(msg.type()==="error")consoleErrors.push(msg.text())});page.on("pageerror",err=>consoleErrors.push(err.message));
  page.on("request",request=>{if(["POST","PUT","PATCH","DELETE"].includes(request.method()))writes.push(request.url());});
  await page.goto("/");
  await expect(page.locator("#account-email")).toHaveCount(0);
  await expect(page.getByText("QA DATA PROVIDER",{exact:true})).toBeVisible();
  await expect(page.getByTestId("qa-scenario-toggle")).toBeVisible();

  await page.getByTestId("nav-customers").click();
  await expect(page.getByLabel("Search name, code or territory")).toBeVisible();
  await expect(page.getByText("Dr. Ananya Rao",{exact:true})).toBeVisible();

  await page.getByTestId("nav-activities").click();
  for(const id of ["#activity-kind","#activity-date","#activity-territory","#activity-reason","#activity-duration","#activity-remarks"])await expect(page.locator(id)).toBeVisible();

  await page.getByTestId("nav-edetailing").click();
  await expect(page.getByTestId("clm-search")).toBeVisible();
  await expect(page.getByText("Core Brand Aid",{exact:true})).toBeVisible();

  await page.getByTestId("nav-field").click();
  await expect(page.getByTestId("qa-field-execution")).toBeVisible();
  await expect(page.getByTestId("visit-checkin-visit-doc-01")).toBeVisible();

  await page.getByTestId("nav-trade").click();
  await expect(page.getByTestId("rcpa-product")).toBeVisible();
  await expect(page.getByTestId("pob-product")).toBeVisible();

  await page.getByTestId("nav-inventory").click();
  await expect(page.getByTestId("inventory-item")).toBeVisible();
  await expect(page.getByTestId("inventory-qty")).toBeVisible();

  await page.getByTestId("nav-workforce").click();
  await expect(page.getByTestId("leave-from")).toBeVisible();
  await expect(page.getByTestId("expense-category")).toBeVisible();

  await page.getByTestId("nav-approvals").click();
  await expect(page.getByTestId("manager-review-comment")).toBeVisible();

  await page.getByTestId("nav-manager").click();
  await expect(page.getByTestId("qa-manager-command")).toBeVisible();
  await expect(page.getByTestId("manager-command-comment")).toBeVisible();

  await page.getByTestId("nav-admin").click();
  await expect(page.getByTestId("org-code")).toBeVisible();
  await expect(page.getByTestId("masters-kind")).toBeVisible();
  await expect(page.getByTestId("assign-user")).toBeVisible();

  await page.getByTestId("nav-platform").click();
  await expect(page.getByTestId("platform-name")).toBeVisible();
  await expect(page.getByTestId("platform-code")).toBeVisible();

  expect(writes).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
