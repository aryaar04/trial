document.addEventListener("DOMContentLoaded", () => {
    const editButtons = document.querySelectorAll(".edit");
    const modal = document.getElementById("editModal");
    const closeModal = document.querySelector(".modal .close");
    const editForm = document.getElementById("editForm");
    const newQuantityInput = document.getElementById("newQuantity");
    const itemIdInput = document.getElementById("itemId");

    editButtons.forEach(button => {
        button.addEventListener("click", () => {
            const row = button.closest("tr");
            const quantity = row.querySelector(".quantity").textContent;
            const itemId = button.getAttribute("data-item");
            
            newQuantityInput.value = quantity;
            itemIdInput.value = itemId;

            modal.style.display = "flex";
        });
    });

    closeModal.addEventListener("click", () => {
        modal.style.display = "none";
    });

    window.addEventListener("click", (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    });

    editForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const newQuantity = newQuantityInput.value;
        const itemId = itemIdInput.value;

        // Update the quantity in the UI (you would also send this to the server)
        document.querySelector(`.edit[data-item="${itemId}"]`)
            .closest("tr")
            .querySelector(".quantity").textContent = newQuantity;

        modal.style.display = "none";
    });
});
