import {test,expect} from "@playwright/test";

test("functional QA mode exposes operational fields without login",async({page})=>{
  const writes:string[]=[];
  page.on("request",request=>{if(["POST","PUT","PATCH","DELETE"].includes(request.method()))writes.push(request.url());});
  await page.goto("/");
  await expect(page.locator("#account-email")).toHaveCount(0);
  await expect(page.getByText("FUNCTIONAL QA",{exact:true})).toBeVisible();

  await page.getByRole("button",{name:"Customer 360",exact:true}).click();
  await expect(page.getByLabel("Search name, code or territory")).toBeVisible();

  await page.getByRole("button",{name:"NCA & activities",exact:true}).click();
  await expect(page.locator("#activity-kind")).toBeVisible();
  await expect(page.locator("#activity-date")).toBeVisible();
  await expect(page.locator("#activity-territory")).toBeVisible();

  await page.getByRole("button",{name:"E-detailing / CLM",exact:true}).click();
  await expect(page.locator("#detail-search")).toBeVisible();
  await expect(page.locator("#detail-product")).toBeVisible();

  await page.getByRole("button",{name:"Field execution",exact:true}).click();
  await expect(page.locator("#approved-day")).toBeVisible();

  await page.getByRole("button",{name:"Tour planning",exact:true}).click();
  await page.getByRole("button",{name:"Daily Tour Plan"}).click();
  await expect(page.locator("#calendar-territory")).toBeVisible();
  await expect(page.locator("#calendar-visit-type")).toBeVisible();

  await page.getByRole("button",{name:"RCPA & orders",exact:true}).click();
  await expect(page.locator("#rcpa-product")).toBeVisible();
  await expect(page.locator("#order-product")).toBeVisible();

  await page.getByRole("button",{name:"Samples & inventory",exact:true}).click();
  await expect(page.locator("#allocation-type")).toBeVisible();
  await expect(page.locator("#allocation-item")).toBeVisible();

  await page.getByRole("button",{name:"Workforce operations",exact:true}).click();
  await expect(page.locator("#week-start")).toBeVisible();
  await expect(page.locator("#leave-type")).toBeVisible();
  await expect(page.locator("#expense-category")).toBeVisible();

  await page.getByRole("button",{name:"Manager approvals",exact:true}).click();
  await expect(page.locator("#review-comment")).toBeVisible();

  await page.getByRole("button",{name:"Manager command",exact:true}).click();
  await expect(page.locator("#approval-comment")).toBeVisible();

  await page.getByRole("button",{name:"Organization admin",exact:true}).click();
  await expect(page.locator("#org-code")).toBeVisible();
  await expect(page.locator("#masters-kind")).toBeVisible();
  await expect(page.locator("#assign-user")).toBeVisible();

  expect(writes).toEqual([]);
});
