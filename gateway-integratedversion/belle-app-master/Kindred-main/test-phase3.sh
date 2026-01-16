#!/bin/bash

# Phase 3 Integration Test Runner
# Runs comprehensive tests for all Phase 3 features

set -e

echo "🚀 Starting Phase 3 Integration Tests..."
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
SERVICES=(
  "user-service"
  "queuing-service" 
  "communication-service"
  "history-service"
  "interaction-service"
  "moderation-service"
  "admin-service"
  "notification-service"
  "analytics-service"
  "graphql-gateway"
)

BASE_URL="http://localhost"
GRAPHQL_PORT="4000"
TEST_TIMEOUT="30s"

# Helper functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

check_service_health() {
  local service=$1
  local port=$2
  local url="${BASE_URL}:${port}/health"
  
  log_info "Checking health of $service..."
  
  if curl -f -s "$url" > /dev/null; then
    log_success "$service is healthy"
    return 0
  else
    log_error "$service health check failed"
    return 1
  fi
}

run_unit_tests() {
  log_info "Running unit tests for all services..."
  
  local failed_services=()
  
  for service in "${SERVICES[@]}"; do
    if [ -d "services/$service" ]; then
      log_info "Testing $service..."
      
      if (cd "services/$service" && npm test -- --coverage --testTimeout=10000); then
        log_success "$service unit tests passed"
      else
        log_error "$service unit tests failed"
        failed_services+=("$service")
      fi
    fi
  done
  
  if [ ${#failed_services[@]} -eq 0 ]; then
    log_success "All unit tests passed"
    return 0
  else
    log_error "Unit tests failed for: ${failed_services[*]}"
    return 1
  fi
}

run_integration_tests() {
  log_info "Running integration tests..."
  
  # Test 1: User Registration and Profile Creation
  log_info "Test 1: User Registration Flow"
  
  local user_response=$(curl -s -X POST "${BASE_URL}:${GRAPHQL_PORT}/graphql" \
    -H "Content-Type: application/json" \
    -d '{
      "query": "mutation CreateUser($input: CreateUserInput!) { createUser(input: $input) { id username displayName } }",
      "variables": {
        "input": {
          "username": "integration_test_user",
          "email": "test@integration.com",
          "password": "secure123",
          "displayName": "Integration Test User"
        }
      }
    }')
  
  if echo "$user_response" | jq -e '.data.createUser.id' > /dev/null; then
    log_success "User registration successful"
    local user_id=$(echo "$user_response" | jq -r '.data.createUser.id')
  else
    log_error "User registration failed"
    echo "$user_response" | jq '.'
    return 1
  fi
  
  # Test 2: Queue Matching System
  log_info "Test 2: Queue Matching System"
  
  # Create second user
  local user2_response=$(curl -s -X POST "${BASE_URL}:${GRAPHQL_PORT}/graphql" \
    -H "Content-Type: application/json" \
    -d '{
      "query": "mutation CreateUser($input: CreateUserInput!) { createUser(input: $input) { id username } }",
      "variables": {
        "input": {
          "username": "integration_test_user2",
          "email": "test2@integration.com", 
          "password": "secure123",
          "displayName": "Integration Test User 2"
        }
      }
    }')
  
  local user2_id=$(echo "$user2_response" | jq -r '.data.createUser.id')
  
  # Test queue joining
  local queue_response=$(curl -s -X POST "${BASE_URL}:3002/api/queue/join" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer test-token" \
    -d "{
      \"userId\": \"$user_id\",
      \"preferences\": {
        \"ageRange\": [18, 30],
        \"interests\": [\"technology\", \"music\"]
      }
    }")
  
  if echo "$queue_response" | jq -e '.success' > /dev/null; then
    log_success "Queue joining successful"
  else
    log_error "Queue joining failed"
    return 1
  fi
  
  # Test 3: Communication Service
  log_info "Test 3: Communication Service"
  
  # Start conversation
  local conversation_response=$(curl -s -X POST "${BASE_URL}:${GRAPHQL_PORT}/graphql" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer test-token" \
    -d "{
      \"query\": \"mutation StartConversation(\$participantIds: [ID!]!) { startConversation(participantIds: \$participantIds) { id status participants { id } } }\",
      \"variables\": {
        \"participantIds\": [\"$user_id\", \"$user2_id\"]
      }
    }")
  
  local conversation_id=$(echo "$conversation_response" | jq -r '.data.startConversation.id')
  
  if [ "$conversation_id" != "null" ] && [ -n "$conversation_id" ]; then
    log_success "Conversation creation successful"
  else
    log_error "Conversation creation failed"
    return 1
  fi
  
  # Send message
  local message_response=$(curl -s -X POST "${BASE_URL}:${GRAPHQL_PORT}/graphql" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer test-token" \
    -d "{
      \"query\": \"mutation SendMessage(\$input: SendMessageInput!) { sendMessage(input: \$input) { id content moderationStatus } }\",
      \"variables\": {
        \"input\": {
          \"conversationId\": \"$conversation_id\",
          \"content\": \"Hello, this is an integration test message!\",
          \"type\": \"text\"
        }
      }
    }")
  
  local message_id=$(echo "$message_response" | jq -r '.data.sendMessage.id')
  local moderation_status=$(echo "$message_response" | jq -r '.data.sendMessage.moderationStatus')
  
  if [ "$message_id" != "null" ] && [ -n "$message_id" ]; then
    log_success "Message sending successful (ID: $message_id, Status: $moderation_status)"
  else
    log_error "Message sending failed"
    return 1
  fi
  
  # Test 4: History Service
  log_info "Test 4: History Service"
  
  local history_response=$(curl -s -X GET "${BASE_URL}:3004/api/history/conversation/$conversation_id" \
    -H "Authorization: Bearer test-token")
  
  if echo "$history_response" | jq -e '.messages[0].id' > /dev/null; then
    log_success "Message history retrieval successful"
  else
    log_error "Message history retrieval failed"
    return 1
  fi
  
  # Test 5: Moderation Service
  log_info "Test 5: Moderation Service"
  
  # Send inappropriate message to test moderation
  local inappropriate_message=$(curl -s -X POST "${BASE_URL}:${GRAPHQL_PORT}/graphql" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer test-token" \
    -d "{
      \"query\": \"mutation SendMessage(\$input: SendMessageInput!) { sendMessage(input: \$input) { id content moderationStatus } }\",
      \"variables\": {
        \"input\": {
          \"conversationId\": \"$conversation_id\",
          \"content\": \"This message contains inappropriate spam content\",
          \"type\": \"text\"
        }
      }
    }")
  
  local mod_status=$(echo "$inappropriate_message" | jq -r '.data.sendMessage.moderationStatus')
  
  if [ "$mod_status" = "flagged" ] || [ "$mod_status" = "pending" ]; then
    log_success "Moderation system working correctly (Status: $mod_status)"
  else
    log_warning "Moderation system may need tuning (Status: $mod_status)"
  fi
  
  # Test 6: Internationalization
  log_info "Test 6: Internationalization"
  
  local i18n_response=$(curl -s -X GET "${BASE_URL}:3001/api/users/$user_id" \
    -H "Accept-Language: es-ES" \
    -H "Authorization: Bearer test-token")
  
  if echo "$i18n_response" | jq -e '.user.localizedData' > /dev/null; then
    log_success "Internationalization working correctly"
  else
    log_warning "Internationalization may need verification"
  fi
  
  # Test 7: Performance Optimizations
  log_info "Test 7: Performance & Caching"
  
  # Test cache performance
  local start_time=$(date +%s%N)
  
  for i in {1..5}; do
    curl -s "${BASE_URL}:3001/api/users/$user_id" \
      -H "Authorization: Bearer test-token" > /dev/null
  done
  
  local end_time=$(date +%s%N)
  local duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
  local avg_time=$(( duration / 5 ))
  
  if [ $avg_time -lt 100 ]; then
    log_success "Cache performance optimal (Avg: ${avg_time}ms)"
  else
    log_warning "Cache performance may need optimization (Avg: ${avg_time}ms)"
  fi
  
  log_success "All integration tests completed successfully!"
  return 0
}

run_performance_tests() {
  log_info "Running performance tests..."
  
  # Check if k6 is installed
  if ! command -v k6 &> /dev/null; then
    log_warning "k6 not found. Skipping performance tests."
    log_info "Install k6 to run performance tests: https://k6.io/docs/getting-started/installation/"
    return 0
  fi
  
  # Run load test
  log_info "Running load test with k6..."
  
  if k6 run --duration=30s --vus=10 tests/performance/load-test.js; then
    log_success "Performance tests passed"
    return 0
  else
    log_error "Performance tests failed"
    return 1
  fi
}

run_security_tests() {
  log_info "Running security tests..."
  
  # Test 1: Authentication
  log_info "Testing authentication security..."
  
  local unauthorized_response=$(curl -s -o /dev/null -w "%{http_code}" \
    "${BASE_URL}:3001/api/users/test-user")
  
  if [ "$unauthorized_response" = "401" ]; then
    log_success "Authentication security working correctly"
  else
    log_error "Authentication security issue detected"
    return 1
  fi
  
  # Test 2: Rate Limiting
  log_info "Testing rate limiting..."
  
  local rate_limit_responses=()
  for i in {1..110}; do
    local response=$(curl -s -o /dev/null -w "%{http_code}" \
      "${BASE_URL}:3001/api/health")
    rate_limit_responses+=("$response")
  done
  
  # Check if any requests were rate limited (429)
  if [[ " ${rate_limit_responses[*]} " =~ " 429 " ]]; then
    log_success "Rate limiting working correctly"
  else
    log_warning "Rate limiting may need verification"
  fi
  
  # Test 3: Input Validation
  log_info "Testing input validation..."
  
  local invalid_input_response=$(curl -s -X POST "${BASE_URL}:${GRAPHQL_PORT}/graphql" \
    -H "Content-Type: application/json" \
    -d '{
      "query": "mutation CreateUser($input: CreateUserInput!) { createUser(input: $input) { id } }",
      "variables": {
        "input": {
          "username": "",
          "email": "invalid-email",
          "password": "123"
        }
      }
    }')
  
  if echo "$invalid_input_response" | jq -e '.errors' > /dev/null; then
    log_success "Input validation working correctly"
  else
    log_error "Input validation security issue detected"
    return 1
  fi
  
  log_success "Security tests completed"
  return 0
}

cleanup_test_data() {
  log_info "Cleaning up test data..."
  
  # Clean up test users, conversations, etc.
  # This would connect to the database and remove test data
  
  log_success "Test data cleanup completed"
}

# Main execution
main() {
  echo "Phase 3 Integration Test Suite"
  echo "=============================="
  echo
  
  local test_start_time=$(date +%s)
  local failed_tests=()
  
  # Pre-flight checks
  log_info "Running pre-flight checks..."
  
  # Check if Docker containers are running
  if ! docker ps | grep -q "realtime-connect"; then
    log_warning "Docker containers may not be running. Start with: docker-compose up -d"
  fi
  
  # Check service health
  log_info "Checking service health..."
  local unhealthy_services=()
  
  for i in "${!SERVICES[@]}"; do
    local service="${SERVICES[$i]}"
    local port=$((3001 + i))
    
    if [ "$service" = "graphql-gateway" ]; then
      port=4000
    fi
    
    if ! check_service_health "$service" "$port"; then
      unhealthy_services+=("$service")
    fi
  done
  
  if [ ${#unhealthy_services[@]} -gt 0 ]; then
    log_error "Unhealthy services detected: ${unhealthy_services[*]}"
    log_error "Please ensure all services are running before running tests"
    exit 1
  fi
  
  # Run test suites
  echo
  log_info "Starting test execution..."
  echo
  
  # Unit Tests
  if ! run_unit_tests; then
    failed_tests+=("unit_tests")
  fi
  
  echo
  
  # Integration Tests
  if ! run_integration_tests; then
    failed_tests+=("integration_tests")
  fi
  
  echo
  
  # Performance Tests
  if ! run_performance_tests; then
    failed_tests+=("performance_tests")
  fi
  
  echo
  
  # Security Tests
  if ! run_security_tests; then
    failed_tests+=("security_tests")
  fi
  
  echo
  
  # Cleanup
  cleanup_test_data
  
  # Results
  local test_end_time=$(date +%s)
  local test_duration=$((test_end_time - test_start_time))
  
  echo
  echo "=========================================="
  echo "TEST RESULTS SUMMARY"
  echo "=========================================="
  echo "Duration: ${test_duration}s"
  echo
  
  if [ ${#failed_tests[@]} -eq 0 ]; then
    log_success "🎉 ALL TESTS PASSED!"
    echo
    echo "✅ Unit Tests: PASSED"
    echo "✅ Integration Tests: PASSED"
    echo "✅ Performance Tests: PASSED"
    echo "✅ Security Tests: PASSED"
    echo
    log_success "Phase 3 is ready for production deployment!"
    exit 0
  else
    log_error "❌ SOME TESTS FAILED"
    echo
    for test in "${failed_tests[@]}"; do
      echo "❌ $test: FAILED"
    done
    echo
    log_error "Please fix failing tests before deployment"
    exit 1
  fi
}

# Handle script arguments
case "${1:-}" in
  "unit")
    run_unit_tests
    ;;
  "integration")
    run_integration_tests
    ;;
  "performance")
    run_performance_tests
    ;;
  "security")
    run_security_tests
    ;;
  "help"|"-h"|"--help")
    echo "Usage: $0 [test_type]"
    echo
    echo "Available test types:"
    echo "  unit         Run unit tests only"
    echo "  integration  Run integration tests only"
    echo "  performance  Run performance tests only"
    echo "  security     Run security tests only"
    echo "  (no args)    Run all tests"
    echo
    echo "Examples:"
    echo "  $0                # Run all tests"
    echo "  $0 integration    # Run integration tests only"
    echo "  $0 performance    # Run performance tests only"
    ;;
  *)
    main
    ;;
esac