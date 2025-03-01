import { initDb, useDb } from "../../../../environment-helpers/use-db"

import { Region } from "@medusajs/medusa"
import { AxiosInstance } from "axios"
import path from "path"
import setupServer from "../../../../environment-helpers/setup-server"
import { useApi } from "../../../../environment-helpers/use-api"
import { getContainer } from "../../../../environment-helpers/use-container"
import adminSeeder from "../../../../helpers/admin-seeder"
import { createDefaultRuleTypes } from "../../../helpers/create-default-rule-types"

jest.setTimeout(50000)

const adminHeaders = {
  headers: {
    "x-medusa-access-token": "test_token",
  },
}

const env = {
  MEDUSA_FF_ISOLATE_PRICING_DOMAIN: true,
  MEDUSA_FF_ISOLATE_PRODUCT_DOMAIN: true,
}

describe.skip("[Product & Pricing Module] POST /admin/products", () => {
  let dbConnection
  let appContainer
  let medusaProcess

  beforeAll(async () => {
    const cwd = path.resolve(path.join(__dirname, "..", "..", ".."))
    dbConnection = await initDb({ cwd, env } as any)
    medusaProcess = await setupServer({ cwd, env, bootstrapApp: true } as any)
    appContainer = getContainer()
  })

  afterAll(async () => {
    const db = useDb()
    await db.shutdown()
    medusaProcess.kill()
  })

  beforeEach(async () => {
    const manager = dbConnection.manager
    await adminSeeder(dbConnection)
    await createDefaultRuleTypes(appContainer)

    await manager.insert(Region, {
      id: "test-region",
      name: "Test Region",
      currency_code: "usd",
      tax_rate: 0,
    })
  })

  afterEach(async () => {
    const db = useDb()
    await db.teardown()
  })

  it("should create prices with region_id and currency_code context", async () => {
    const api = useApi()! as AxiosInstance

    const data = {
      title: "test product",
      options: [{ title: "test-option" }],
      variants: [
        {
          title: "test variant",
          prices: [
            {
              amount: 66600,
              region_id: "test-region",
            },
            {
              amount: 55500,
              currency_code: "usd",
            },
          ],
          options: [{ value: "test-option" }],
        },
      ],
    }

    let response = await api.post(
      "/admin/products?relations=variants.prices",
      data,
      adminHeaders
    )

    expect(response.status).toEqual(200)
    expect(response.data).toEqual({
      product: expect.objectContaining({
        id: expect.any(String),
        title: "test product",
        variants: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            title: "test variant",
            prices: expect.arrayContaining([
              expect.objectContaining({
                amount: 66600,
                currency_code: "usd",
              }),
              expect.objectContaining({
                amount: 55500,
                currency_code: "usd",
              }),
            ]),
          }),
        ]),
      }),
    })
  })
})
