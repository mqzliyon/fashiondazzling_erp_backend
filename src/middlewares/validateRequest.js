function validateRequest(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const error = new Error(firstIssue?.message || "Invalid request payload");
      error.statusCode = 400;
      error.flatten = result.error.flatten();
      return next(error);
    }

    req.body = result.data.body;
    req.params = result.data.params;
    req.query = result.data.query;
    return next();
  };
}

module.exports = validateRequest;
