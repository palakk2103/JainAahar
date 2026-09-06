import { jest } from "@jest/globals";

const mockCreate = jest.fn();
const mockFindByIdAndUpdate = jest.fn();
const mockFindOne = jest.fn();
const mockExists = jest.fn().mockResolvedValue(false);

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: {
    create: mockCreate,
    findByIdAndUpdate: mockFindByIdAndUpdate,
    findOne: mockFindOne,
    exists: mockExists,
  },
}));

jest.unstable_mockModule("../app/services/cacheService.js", () => ({
  buildKey: () => "test-key",
  invalidate: jest.fn().mockResolvedValue(),
  getOrSet: jest.fn(),
  getTTL: jest.fn(),
}));

jest.unstable_mockModule("../app/services/searchSyncService.js", () => ({
  enqueueProductIndex: jest.fn().mockResolvedValue(),
  enqueueProductRemoval: jest.fn().mockResolvedValue(),
}));

jest.unstable_mockModule("../app/services/mediaService.js", () => ({
  uploadToCloudinary: jest.fn().mockResolvedValue("https://res.cloudinary.com/test.jpg"),
}));

jest.unstable_mockModule("../app/services/logger.js", () => ({
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.unstable_mockModule("../app/utils/storeResolver.js", () => ({
  resolveAdminStore: jest.fn().mockResolvedValue(null),
}));

const { createProduct, updateProduct } = await import("../app/controller/productController.js");

describe("Product Creation & Update Sanitization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("successfully creates a product when subcategoryId is empty string without throwing 500", async () => {
    mockCreate.mockImplementation(async (data) => ({
      _id: "prod-123",
      ...data,
      toObject: () => ({ _id: "prod-123", ...data }),
    }));

    const req = {
      user: { id: "admin-1", role: "admin" },
      body: {
        name: "Kismis Premium",
        price: "250",
        salePrice: "220",
        stock: "50",
        headerId: "65f000000000000000000001",
        categoryId: "65f000000000000000000002",
        subcategoryId: "", // empty subcategory
        sellerId: "",
      },
      files: [],
    };

    let responseData = {};
    let statusCode = 200;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      },
    };

    await createProduct(req, res);

    expect(statusCode).toBe(201);
    expect(responseData.success).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const savedData = mockCreate.mock.calls[0][0];
    expect(savedData.subcategoryId).toBeNull();
    expect(savedData.sellerId).toBeNull();
    expect(savedData.name).toBe("Kismis Premium");
    expect(savedData.price).toBe(250);
  });

  test("handles ValidationError gracefully returning 400 instead of 500", async () => {
    const validationError = new Error("Validation failed");
    validationError.name = "ValidationError";
    validationError.errors = {
      headerId: { message: "Header category is required" },
    };
    mockCreate.mockRejectedValue(validationError);

    const req = {
      user: { id: "admin-1", role: "admin" },
      body: {
        name: "Kismis Without Category",
        price: "200",
      },
      files: [],
    };

    let responseData = {};
    let statusCode = 200;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      },
    };

    await createProduct(req, res);

    expect(statusCode).toBe(400);
    expect(responseData.success).toBe(false);
    expect(responseData.message).toContain("Header category is required");
  });
});
