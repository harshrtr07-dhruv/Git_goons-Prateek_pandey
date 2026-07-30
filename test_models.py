import pickle

print("--- ArXiv Accelerator Model Testing ---")

try:
    with open('models_claims.pkl', 'rb') as f:
        claims_model = pickle.load(f)
    with open('models_defs.pkl', 'rb') as f:
        defs_model = pickle.load(f)
except Exception as e:
    print(f"Error loading models: {e}")
    exit(1)

# Test Data
test_claims = [
    ("We present a novel approach to solve the traveling salesman problem.", 1),
    ("Our results demonstrate a 25% reduction in latency compared to existing systems.", 1),
    ("The study concludes that sleep deprivation significantly impairs cognitive function.", 1),
    ("I went to the store to buy some apples and bananas.", 0),
    ("Table 3 summarizes the demographic information of the participants.", 0),
    ("The weather was surprisingly warm for December.", 0)
]

test_definitions = [
    ("Artificial Intelligence refers to the simulation of human intelligence in machines.", 1),
    ("A hypothesis is a proposed explanation for a phenomenon.", 1),
    ("Photosynthesis is defined as the process used by plants to convert light energy into chemical energy.", 1),
    ("We trained the neural network using stochastic gradient descent.", 0),
    ("The server went offline due to an unexpected power outage.", 0),
    ("Please refer to Figure 4 for an illustration of the architecture.", 0)
]

print("\n--- Testing Claims Model ---")
correct_claims = 0
for text, label in test_claims:
    prediction = claims_model.predict([text])[0]
    result = "[CORRECT]" if prediction == label else "[INCORRECT]"
    if prediction == label: correct_claims += 1
    predicted_label = "Claim" if prediction == 1 else "Not Claim"
    print(f"{result} Pred: [{predicted_label}] | Text: '{text}'")
print(f"Claims Model Accuracy on Unseen Test Set: {correct_claims}/{len(test_claims)}")


print("\n--- Testing Definitions Model ---")
correct_defs = 0
for text, label in test_definitions:
    prediction = defs_model.predict([text])[0]
    result = "[CORRECT]" if prediction == label else "[INCORRECT]"
    if prediction == label: correct_defs += 1
    predicted_label = "Definition" if prediction == 1 else "Not Definition"
    print(f"{result} Pred: [{predicted_label}] | Text: '{text}'")
print(f"Definitions Model Accuracy on Unseen Test Set: {correct_defs}/{len(test_definitions)}")
