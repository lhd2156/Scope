moved {
  from = aws_vpc.atlas
  to   = aws_vpc.scope
}

moved {
  from = aws_internet_gateway.atlas
  to   = aws_internet_gateway.scope
}

moved {
  from = aws_cognito_user_pool.atlas
  to   = aws_cognito_user_pool.scope
}

moved {
  from = aws_cognito_user_pool_domain.atlas
  to   = aws_cognito_user_pool_domain.scope
}
